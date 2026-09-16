-- ==============================================================================
-- MIGRATION 001 — Couche d'enrichissement des offres
-- Ajouter à la table jobs + créer job_enrichments
-- À appliquer via la console Supabase (SQL Editor)
-- ==============================================================================

-- --------------------------------------------------------------------------
-- 1. EXTENSIONS supplémentaires
-- --------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- --------------------------------------------------------------------------
-- 2. COLONNES ajoutées à la table jobs
-- --------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS enriched_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slug         TEXT;

-- Index partiel unique sur slug (NULL autorisé pendant l'ingestion)
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_slug
  ON public.jobs (slug)
  WHERE slug IS NOT NULL;

-- Index pour récupérer efficacement les offres non encore enrichies
CREATE INDEX IF NOT EXISTS idx_jobs_unenriched
  ON public.jobs (created_at ASC)
  WHERE enriched_at IS NULL AND is_active = true;

-- --------------------------------------------------------------------------
-- 3. TABLE : job_enrichments (1-to-1 avec jobs)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_enrichments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,

  -- ── Module 1 : Normalisation ────────────────────────────────────────────
  title_canonical             TEXT,
  title_canonical_confidence  NUMERIC(3,2),

  seniority                   TEXT CHECK (seniority IN (
                                'junior','confirmed','senior','lead','staff','manager'
                              )),
  seniority_confidence        NUMERIC(3,2),
  seniority_method            TEXT,         -- 'title' | 'description' | 'default'

  remote_policy_parsed        TEXT CHECK (remote_policy_parsed IN (
                                'full_remote','hybrid','onsite','remote_friendly'
                              )),
  remote_days_onsite          SMALLINT,     -- nb jours sur site si hybrid
  remote_policy_confidence    NUMERIC(3,2),

  location_city               TEXT,
  location_region             TEXT,
  location_country            VARCHAR(3),
  location_lat                NUMERIC(9,6),
  location_lon                NUMERIC(9,6),

  tech_stack                  TEXT[] NOT NULL DEFAULT '{}',
  dedup_key                   TEXT,         -- clé normalisée pour fuzzy matching

  -- ── Module 2 : Classification ESN / Produit ─────────────────────────────
  company_category            TEXT CHECK (company_category IN (
                                'esn_ssii','cabinet_conseil','editeur_produit',
                                'scale_up','startup','grand_groupe','eti',
                                'secteur_public','autre'
                              )),
  company_category_confidence NUMERIC(3,2),
  company_category_method     TEXT,         -- 'reference_table' | 'heuristic' | 'llm'

  -- ── Module 3 : Estimation de salaire ────────────────────────────────────
  salary_estimated_min        NUMERIC(10,2),
  salary_estimated_max        NUMERIC(10,2),
  salary_estimated_median     NUMERIC(10,2),
  salary_estimated_currency   VARCHAR(3),
  salary_estimated_period     TEXT,         -- 'yearly' | 'daily'
  salary_geo_base             TEXT,         -- ex: 'Île-de-France' | 'national'
  salary_sample_size          INTEGER,      -- 0 = grille benchmark
  salary_confidence           NUMERIC(3,2),
  salary_data_source          TEXT,         -- ex: 'corpus_db' | 'benchmark_salair etech_2024'

  -- ── Module 4 : Signaux employeur ────────────────────────────────────────
  employer_repost_count       SMALLINT DEFAULT 0,
  employer_open_positions     SMALLINT DEFAULT 0,
  employer_trustpilot_score   NUMERIC(3,1),
  employer_trustpilot_reviews INTEGER,
  employer_signals_confidence NUMERIC(3,2),

  -- ── Module 5 : Contexte local ───────────────────────────────────────────
  local_context               JSONB,

  -- ── Méta ────────────────────────────────────────────────────────────────
  enrichment_version          VARCHAR(20) NOT NULL DEFAULT '1.0',
  enriched_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_job_enrichments_job_id UNIQUE (job_id)
);

-- --------------------------------------------------------------------------
-- 4. INDEX sur job_enrichments
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_enrich_job_id
  ON public.job_enrichments (job_id);

CREATE INDEX IF NOT EXISTS idx_enrich_company_category
  ON public.job_enrichments (company_category);

CREATE INDEX IF NOT EXISTS idx_enrich_seniority
  ON public.job_enrichments (seniority);

CREATE INDEX IF NOT EXISTS idx_enrich_salary_median
  ON public.job_enrichments (salary_estimated_median)
  WHERE salary_estimated_median IS NOT NULL;

-- Index trigramme pour le fuzzy dedup
CREATE INDEX IF NOT EXISTS idx_enrich_dedup_key_trgm
  ON public.job_enrichments
  USING GIN (dedup_key extensions.gin_trgm_ops);

-- --------------------------------------------------------------------------
-- 5. SÉCURITÉ RLS sur job_enrichments
-- --------------------------------------------------------------------------
ALTER TABLE public.job_enrichments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public users can view job enrichments" ON public.job_enrichments;
CREATE POLICY "Public users can view job enrichments"
  ON public.job_enrichments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role has full access to job enrichments" ON public.job_enrichments;
CREATE POLICY "Service role has full access to job enrichments"
  ON public.job_enrichments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 6. COMMENTAIRES
-- --------------------------------------------------------------------------
COMMENT ON TABLE public.job_enrichments IS
  'Couche d''enrichissement 1-to-1 avec jobs : normalisation, ESN, salaire estimé, signaux employeur, contexte local';
COMMENT ON COLUMN public.job_enrichments.dedup_key IS
  'Clé normalisée (company + title_canonical + city) pour fuzzy matching inter-sources via pg_trgm';
COMMENT ON COLUMN public.job_enrichments.salary_sample_size IS
  '0 = grille benchmark statique, >0 = calculé sur N offres réelles de la base';
COMMENT ON COLUMN public.job_enrichments.local_context IS
  'JSONB : { similar_jobs_count, ecosystem_note, cost_of_life_index, avg_salary_region }';
