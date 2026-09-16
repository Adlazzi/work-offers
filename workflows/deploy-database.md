# Procédure : Déploiement & Réinitialisation du Schéma Supabase (`deploy-database.md`)

Ce document détaille la démarche pour appliquer, mettre à jour ou réinitialiser le schéma SQL de la base de données PostgreSQL hébergée sur Supabase.

---

## 1. Vue d'Ensemble du Schéma

Le schéma du projet s'articule autour des composants suivants :
- **Types énumérés :** `contract_type` (`cdi`, `cdd`, `freelance`, `stage`, `alternance`), `remote_policy` (`full`, `partial`, `none`).
- **Table `sources` :** Liste des fournisseurs de données (APIs, flux RSS, connecteurs partenaires).
- **Table `jobs` :** Données normalisées des offres d'emploi, avec contrainte unique sur l'empreinte `fingerprint` et index de recherche plein texte (`tsvector` / `pg_trgm`).
- **Table `user_alerts` :** Critères de recherche enregistrés par les utilisateurs pour le déclenchement d'alertes temps réel.
- **Table `user_bookmarks` :** Favoris sauvegardés par les utilisateurs connectés.
- **Sécurité (RLS) :** Politiques d'accès par rôle (lecture publique sur `jobs`, gestion privée stricte pour `user_alerts` et `user_bookmarks`).

---

## 2. Prérequis

1. Avoir un projet Supabase actif (créé sur [supabase.com](https://supabase.com) ou une instance locale via Supabase CLI).
2. Disposer de l'URL du projet et des clés API (`anon` et `service_role`).
3. Localiser le script de schéma SQL (situé dans `supabase/schema.sql` ou dans les migrations `supabase/migrations/`).

---

## 3. Méthode 1 : Déploiement via le Dashboard Supabase (Méthode Rapide)

Cette méthode est recommandée lors des premières phases de développement et de prototypage.

1. Connectez-vous à la console d'administration [Supabase Dashboard](https://app.supabase.com).
2. Sélectionnez votre projet.
3. Dans la barre latérale gauche, cliquez sur **SQL Editor** (icône `>_`).
4. Cliquez sur **New query** (Nouvelle requête).
5. Ouvrez le fichier de schéma local [`supabase/schema.sql`](file:///Users/ahmedadlane/Documents/projets/work_offers/supabase/schema.sql), copiez l'intégralité du contenu et collez-le dans l'éditeur.
6. Cliquez sur le bouton **Run** (ou `Cmd + Enter` / `Ctrl + Enter`).
7. Vérifiez l'affichage du message vert : `Success. No rows returned`.

---

## 4. Méthode 2 : Déploiement via Supabase CLI (Méthode Recommandée CI/CD)

Pour un suivi rigoureux des versions et migrations :

### Étape 4.1 : Authentification & Liaison du projet
```bash
# Se connecter à Supabase
npx supabase login

# Associer le répertoire local à votre projet distant (trouvez le Reference ID dans Settings > General)
npx supabase link --project-ref <VOTRE_PROJECT_REFERENCE_ID>
```

### Étape 4.2 : Appliquer les migrations
```bash
# Applique les scripts non encore exécutés sur la base distante
npx supabase db push
```

### Étape 4.3 : En cas d'environnement Supabase Local (Docker)
```bash
# Démarrer Supabase en local
npx supabase start

# Réinitialiser la base locale et ré-exécuter toutes les migrations
npx supabase db reset
```

---

## 5. Procédure de Réinitialisation (Reset de Base)

### Scénario A : Vider les offres tout en conservant la structure
Utile après un test d'ingestion mock pour repartir sur une base propre :

```sql
-- Dans le SQL Editor de Supabase :
TRUNCATE TABLE public.jobs RESTART IDENTITY CASCADE;
```

### Scénario B : Réinitialisation complète du schéma (Drop & Re-create)
Pour reconstruire intégralement le schéma depuis zéro en cas de changement majeur :

```sql
-- ⚠️ ATTENTION : Cette opération supprime toutes les données existantes !
DROP TABLE IF EXISTS public.user_bookmarks CASCADE;
DROP TABLE IF EXISTS public.user_alerts CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.sources CASCADE;

DROP TYPE IF EXISTS contract_type_enum CASCADE;
DROP TYPE IF EXISTS remote_policy_enum CASCADE;

-- Ré-exécuter ensuite l'intégralité de supabase/schema.sql
```

---

## 6. Vérifications Post-Déploiement

Exécutez ce script de diagnostic pour confirmer la bonne configuration des tables et des sécurités :

```sql
-- 1. Vérification de l'existence des tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('jobs', 'sources', 'user_alerts', 'user_bookmarks');

-- 2. Vérification de l'activation de RLS (Row Level Security)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- 3. Vérification des contraintes d'unicité (fingerprint)
SELECT conname, contype 
FROM pg_constraint 
WHERE conname = 'jobs_fingerprint_key';
```
