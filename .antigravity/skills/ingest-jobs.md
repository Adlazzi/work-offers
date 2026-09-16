# Procédure : Ingestion Manuelle & Test des Offres d'Emploi (`ingest-jobs.md`)

Ce document décrit la procédure pas-à-pas pour exécuter et valider manuellement l'ingestion d'annonces de dev (Tech & Freelance), que ce soit avec un jeu de données mocké ou via les connecteurs réels (flux RSS et APIs).

---

## 1. Objectif

Permettre aux développeurs de :
1. Tester le pipeline d'ingestion en local sans risque de corrompre les données de production.
2. Valider le mécanisme de normalisation des offres (`JobOffer`) et le calcul du `fingerprint`.
3. Vérifier le comportement de déduplication (ignorer les offres déjà présentes).
4. Inspecter les résultats directement dans la base de données Supabase.

---

## 2. Prérequis

1. Avoir configuré le fichier `.env.local` à la racine du projet avec au minimum :
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=votre_cle_secrete_service_role
   ```
   > ⚠️ **Important :** L'ingestion en masse nécessite impérativement `SUPABASE_SERVICE_ROLE_KEY` afin de pouvoir insérer les données directement dans la table `jobs`.

2. Avoir initialisé la base de données avec le schéma Supabase (voir [`deploy-database.md`](file:///Users/ahmedadlane/Documents/projets/work_offers/workflows/deploy-database.md)).

3. Avoir installé les dépendances du projet :
   ```bash
   npm install
   ```

---

## 3. Étapes d'Exécution

### Étape 3.1 : Exécution en mode simulation (`Dry Run`)
Avant d'écrire en base de données, lancez l'ingestion avec le flag `--dry-run` pour inspecter les annonces extraites et normalisées :

```bash
# Avec le script d'ingestion
npx tsx scripts/ingest-jobs.ts --dry-run
# ou via le script package.json quand configuré
npm run jobs:ingest -- --dry-run
```

**Ce qu'il faut vérifier dans la console :**
- Total des offres collectées par source (ex: Mock: 15, WeLoveDevs: 10, Remotive: 8).
- Détection des champs obligatoires (`title`, `company_name`, `source_url`, `fingerprint`).
- Aucune écriture n'est effectuée sur Supabase en mode `--dry-run`.

---

### Étape 3.2 : Exécution de l'ingestion avec données Mock
Pour alimenter un environnement de test local avec un catalogue complet d'offres réalistes (Frontend React, Backend Node/Go, DevOps, Data, Freelance & CDI) :

```bash
npx tsx scripts/ingest-jobs.ts --source=mock
```

**Sortie attendue :**
```text
[INFO] Connexion à Supabase initialisée...
[INFO] Source sélectionnée : MOCK (20 offres générées)
[INFO] Calcul des empreintes (fingerprints)...
[SUCCESS] 20 offres insérées avec succès dans la table 'jobs'.
[INFO] Durée totale : 420ms
```

---

### Étape 3.3 : Test de déduplication
Relancez immédiatement la même commande pour tester le filtre anti-doublon :

```bash
npx tsx scripts/ingest-jobs.ts --source=mock
```

**Sortie attendue :**
```text
[INFO] 20 offres analysées.
[INFO] 20 offres ignorées (fingerprint déjà existant en base).
[SUCCESS] 0 nouvelle offre insérée.
```

---

### Étape 3.4 : Exécution des connecteurs réels (RSS & APIs)
Pour lancer l'ingestion globale depuis les flux réels :

```bash
npx tsx scripts/ingest-jobs.ts
```

---

## 4. Validation des Données dans Supabase

### Option A : Via la console SQL Supabase
Exécutez la requête suivante dans le **SQL Editor** de Supabase :

```sql
-- Nombre total d'offres ingérées
SELECT count(*) AS total_jobs FROM public.jobs;

-- Répartition par source et type de contrat
SELECT 
    source_name, 
    contract_type, 
    remote_policy,
    count(*) AS nb_offres
FROM public.jobs
GROUP BY source_name, contract_type, remote_policy
ORDER BY nb_offres DESC;

-- Dernières offres insérées
SELECT id, title, company_name, contract_type, published_at, created_at
FROM public.jobs
ORDER BY created_at DESC
LIMIT 10;
```

### Option B : Via Supabase Table Editor
1. Ouvrez le dashboard Supabase.
2. Allez dans **Table Editor** > table `jobs`.
3. Vérifiez la présence des colonnes remplies, notamment `fingerprint`, `source_url`, et `tags`.

---

## 5. Dépannage & Erreurs Fréquentes

| Erreur constatée | Cause probable | Solution |
| :--- | :--- | :--- |
| `Missing SUPABASE_SERVICE_ROLE_KEY` | Fichier `.env.local` incomplet ou mal nommé | Vérifier que `.env.local` est à la racine et contient la clé de service. |
| `PGRST204 / RLS violation` | La clé utilisée est `NEXT_PUBLIC_SUPABASE_ANON_KEY` au lieu de `SUPABASE_SERVICE_ROLE_KEY` | Remplacer la clé dans le script d'ingestion pour outrepasser les règles RLS d'insertion. |
| `Duplicate key value violates unique constraint "jobs_fingerprint_key"` | Conflit sur l'empreinte unique | Normaliser le script pour faire un `upsert` avec `onConflict: 'fingerprint'` ou ignorer les doublons (`ignoreDuplicates: true`). |
| `XML Parsing Error (RSS feed)` | Le flux distant a renvoyé du HTML ou une erreur 403/429 | Ajouter des en-têtes HTTP valides (`User-Agent`) et encapsuler le parseur dans un `try/catch`. |
