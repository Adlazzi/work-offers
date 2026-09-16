-- ==============================================================================
-- SCHEMA SUPABASE : Table des Annonces & Dépendances ("Jinka pour l'emploi")
-- Fichier : supabase/schema.sql
-- Description : Définition des types, extensions, tables, index de performance,
--               triggers et politiques de sécurité Row Level Security (RLS).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS POSTGRESQL
-- ------------------------------------------------------------------------------

-- Extension pour la recherche floue et l'autocomplétion (trigrammes)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Extension pour la suppression des accents lors de recherches textuelles en français
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;


-- ------------------------------------------------------------------------------
-- 2. TYPES ENUMÉRÉS (Idempotents)
-- ------------------------------------------------------------------------------

-- Types de contrat
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_type') THEN
        CREATE TYPE contract_type AS ENUM (
            'cdi',
            'cdd',
            'freelance',
            'stage',
            'alternance'
        );
    END IF;
END $$;

-- Politiques de télétravail
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'remote_policy') THEN
        CREATE TYPE remote_policy AS ENUM (
            'full',     -- 100% télétravail
            'partial',  -- Hybride
            'none'      -- Présentiel exclusif
        );
    END IF;
END $$;

-- Périodicité du salaire / TJM
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'salary_period') THEN
        CREATE TYPE salary_period AS ENUM (
            'yearly',   -- Salaire annuel brut (ex: CDI)
            'monthly',  -- Salaire mensuel brut (ex: Stage)
            'daily',    -- TJM brut (ex: Freelance)
            'hourly'    -- Taux horaire
        );
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 3. TABLE : sources (Fournisseurs de données)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,          -- Identifiant machine (ex: 'welovedevs', 'remotive', 'francetravail')
    name VARCHAR(100) NOT NULL,                -- Nom d'affichage (ex: 'WeLoveDevs', 'Remotive API')
    base_url TEXT NOT NULL,                    -- URL du site source
    feed_url TEXT,                             -- URL du flux RSS ou endpoint API
    feed_type VARCHAR(20) NOT NULL DEFAULT 'rss', -- 'rss', 'json_api', 'scraper', 'mock'
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------------------------
-- 4. TABLE : jobs (Annonces d'emploi & missions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Métadonnées de l'annonce
    title TEXT NOT NULL,
    company_name TEXT NOT NULL,
    company_logo_url TEXT,
    location TEXT,
    
    -- Catégorisation & Télétravail
    contract_type contract_type NOT NULL DEFAULT 'cdi',
    remote_policy remote_policy NOT NULL DEFAULT 'none',

    -- Rémunération
    salary_min NUMERIC(10, 2),
    salary_max NUMERIC(10, 2),
    salary_period salary_period DEFAULT 'yearly',
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',

    -- Contenu & Compétences
    description TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',         -- ex: ['react', 'typescript', 'nextjs', 'tailwind']

    -- Traçabilité & Redirection
    source_name TEXT NOT NULL,                 -- Nom lisible de la plateforme émettrice
    source_url TEXT NOT NULL,                  -- Lien direct vers l'annonce originale pour postuler
    source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,

    -- Déduplication & Anti-doublons multi-plateformes
    -- SHA-256(company_normalized + title_normalized + location_normalized)
    fingerprint TEXT NOT NULL,

    -- Statuts & Horodatages
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Colonne vectorielle pour la recherche plein texte (maintenue automatiquement par trigger)
    search_vector tsvector,

    -- Contraintes d'intégrité
    CONSTRAINT uq_jobs_fingerprint UNIQUE (fingerprint),
    CONSTRAINT chk_salary_range CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);


-- ------------------------------------------------------------------------------
-- 5. INDEX DE PERFORMANCE
-- ------------------------------------------------------------------------------

-- Index principal pour le flux chronologique des annonces actives
CREATE INDEX IF NOT EXISTS idx_jobs_published_active 
    ON public.jobs (published_at DESC) 
    WHERE is_active = true;

-- Index de filtrage direct par type de contrat et télétravail
CREATE INDEX IF NOT EXISTS idx_jobs_contract_type 
    ON public.jobs (contract_type) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_jobs_remote_policy 
    ON public.jobs (remote_policy) 
    WHERE is_active = true;

-- Index GIN sur les tags techniques (recherche rapide d'intersection de tags : tags @> ARRAY['react'])
CREATE INDEX IF NOT EXISTS idx_jobs_tags_gin 
    ON public.jobs USING GIN (tags);

-- Index GIN pour la recherche plein texte instantanée
CREATE INDEX IF NOT EXISTS idx_jobs_search_vector_gin 
    ON public.jobs USING GIN (search_vector);

-- Index Trigramme pour recherche partielle ou autocomplétion sur le titre et l'entreprise
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm 
    ON public.jobs USING GIN (title extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm 
    ON public.jobs USING GIN (company_name extensions.gin_trgm_ops);


-- ------------------------------------------------------------------------------
-- 6. TRIGGERS : Mise à jour automatique de updated_at
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_sources_updated_at ON public.sources;
CREATE TRIGGER trg_sources_updated_at
    BEFORE UPDATE ON public.sources
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger pour calculer et mettre à jour le champ search_vector (avec pondération de pertinence)
CREATE OR REPLACE FUNCTION public.handle_jobs_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('french', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('french', coalesce(NEW.company_name, '')), 'B') ||
        setweight(to_tsvector('french', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
        setweight(to_tsvector('french', coalesce(NEW.location, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_search_vector ON public.jobs;
CREATE TRIGGER trg_jobs_search_vector
    BEFORE INSERT OR UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_jobs_search_vector();


-- ------------------------------------------------------------------------------
-- 7. SÉCURITÉ & ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------

-- Activation obligatoire de la RLS sur les tables
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

-- Politiques pour la table 'jobs' :
-- 1. Lecture publique : Tout utilisateur (anonyme ou connecté) peut consulter les annonces actives
DROP POLICY IF EXISTS "Public users can view active jobs" ON public.jobs;
CREATE POLICY "Public users can view active jobs" 
    ON public.jobs 
    FOR SELECT 
    USING (is_active = true);

-- 2. Écriture / Modification réservée au service_role (scripts d'ingestion et Edge Functions)
DROP POLICY IF EXISTS "Service role has full access to jobs" ON public.jobs;
CREATE POLICY "Service role has full access to jobs" 
    ON public.jobs 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- Politiques pour la table 'sources' :
DROP POLICY IF EXISTS "Public users can view active sources" ON public.sources;
CREATE POLICY "Public users can view active sources" 
    ON public.sources 
    FOR SELECT 
    USING (is_active = true);

DROP POLICY IF EXISTS "Service role has full access to sources" ON public.sources;
CREATE POLICY "Service role has full access to sources" 
    ON public.sources 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- 8. COMMENTAIRES DE DOCUMENTATION DU SCHÉMA
-- ------------------------------------------------------------------------------

COMMENT ON TABLE public.jobs IS 'Table centrale d''agrégation des annonces Tech & Freelance normalisées';
COMMENT ON COLUMN public.jobs.fingerprint IS 'Hash SHA-256 unique pour déduplication inter-plateformes';
COMMENT ON COLUMN public.jobs.source_url IS 'URL externe de redirection pour postuler sur le site source';
COMMENT ON COLUMN public.jobs.search_vector IS 'Champ vectoriel précalculé pour la recherche textuelle en français';
COMMENT ON COLUMN public.jobs.tags IS 'Liste de tags normalisés (langages, frameworks, méthodologies)';
