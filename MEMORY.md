# MEMORY.md — Journal d'Architecture & Mémoire du Projet

Ce document consigne l'historique des décisions d'architecture, la vision produit, les choix techniques et l'état d'avancement du projet. Il doit être mis à jour à chaque étape structurante du développement.

---

## 1. Vision Produit

- **Nom du concept :** Agrégateur Tech & Freelance (façon *"Jinka pour l'emploi"*).
- **Cible :** Développeurs, DevOps, Data Scientists/Engineers, Product Managers, Designers UI/UX et spécialistes du Digital (en CDI, CDD ou missions Freelance).
- **Proposition de Valeur Unique :**
  - Centraliser toutes les offres issues de plateformes éparses (job boards, flux RSS, APIs publiques, agrégateurs spécialisés).
  - Fournir une expérience de recherche ultra-rapide et ergonomique, orientée Mobile-First.
  - Système d'alertes instantanées (Web Push & emails) dès qu'une annonce correspondant aux critères de l'utilisateur est détectée.

---

## 2. Stack Technique

| Domaine | Technologie retenue | Rôle & Justification |
| :--- | :--- | :--- |
| **Framework Fullstack** | **Next.js (App Router)** | Rendu hybride (Server Components / Streaming), performances SEO, Route Handlers intégrés pour les APIs. |
| **Langage & Typage** | **TypeScript (Strict)** | Sécurité de typage de bout en bout (schéma d'offres normalisé, props, contrats d'API). |
| **Design & UI** | **Tailwind CSS** | Styling utilitaire Mobile-First rapide, responsive et facilement personnalisable. |
| **Base de Données & Auth** | **Supabase (PostgreSQL)** | RDBMS relationnel robuste, Row Level Security (RLS), gestion d'utilisateurs intégrée, extension vectorielle et pg_cron. |
| **Logique Asynchrone / Cron** | **Supabase Edge Functions / Cron** | Ingestion périodique des offres, tâches de fond, déduplication et déclenchement d'alertes. |
| **Système d'Alertes** | **Web Push API (Service Workers)** | Notifications push directes sur navigateur (desktop et mobile/PWA) sans friction d'installation native. |

---

## 3. Décisions d'Architecture

### [ADR-001] Redirection Externe pour Postuler (MVP Phase 1)
- **Décision :** Lors du clic sur "Postuler" ou "Voir l'offre", l'utilisateur est immédiatement redirigé vers la source d'origine de l'annonce via une URL trackée (`source_url`).
- **Contexte / Rationale :** Éviter la complexité d'un système de candidature directe ("Quick Apply") qui nécessiterait des partenariats API bidirectionnels avec les recruteurs, le stockage de CVs et la gestion des statuts de candidature. Le MVP se focalise sur la découverte et l'alerte ultra-rapide.

### [ADR-002] Modèle d'Ingestion Hybride (APIs Publiques + Flux RSS Ouverts)
- **Décision :** La collecte de données repose dans un premier temps sur un pipeline hybride :
  1. Flux RSS ouverts (ex: plateformes tech ouvertes, blogs de recrutement, WeLoveDevs, Remotive, etc.).
  2. APIs publiques ouvertes (ex: API France Travail, Jobicy, RemoteOK, etc.).
- **Contexte / Rationale :** Assure une mise en place rapide sans dépendre de techniques de scraping fragiles et complexes dans la phase MVP.

### [ADR-003] Modèle de Données & Déduplication
- **Schéma unifié :** Chaque offre ingérée est normalisée dans une structure commune (`JobOffer`) comprenant :
  - `id` (UUID)
  - `title` (titre normalisé)
  - `company_name` (nom de l'entreprise)
  - `company_logo_url`
  - `location` (ville, pays ou statut remote)
  - `remote_policy` (`full`, `partial`, `none`)
  - `contract_type` (`cdi`, `cdd`, `freelance`, `internship`, `alternance`)
  - `salary_min`, `salary_max`, `currency`, `salary_period`
  - `tags` (compétences, stack technique)
  - `source_name` & `source_url`
  - `published_at`
  - `fingerprint` : Hachage cryptographique normalisé (`SHA-256(company_normalized + title_normalized + location_normalized)`) afin d'ignorer les doublons multi-plateformes lors des ingestions répétées.

---

## 4. Statut Actuel

- **Phase :** MVP Multi-Sources Avancé (178 annonces réelles actives avec LinkedIn France).
- **Réalisations :**
  - Mise en place du guide de style et conventions (`GEMINI.md` / `CLAUDE.md`).
  - Définition du journal d'architecture et de la mémoire produit (`MEMORY.md`).
  - Schéma SQL Supabase complet déployé (`supabase/schema.sql`) avec index vectoriels et triggers.
  - Pipeline d'ingestion multi-sources (`scripts/ingest-real-jobs.ts`) interconnectant 5 plateformes majeures :
    - **LinkedIn France** : 68 offres réelles (Sopra, Devoteam, Meritis, Nabla, Groupe SII, Blockchain.com...)
    - **Jobicy API** : 40 offres (engineering, cloud, fullstack)
    - **RemoteOK API** : 35 offres (data science, python, mobile, devops)
    - **Himalayas API** : 20 offres (fintech, product, dev)
    - **Remotive API** : 15 offres (software development, architecture IA)
  - Déduplication cryptographique active sur le hash SHA-256 (`fingerprint`) (2 doublons automatiquement filtrés).
  - Interface utilisateur Mobile-First avancée (`app/page.tsx`, `components/JobFeed.tsx`, `components/JobCard.tsx`, `components/JobFilterBar.tsx`, `components/JobDetailModal.tsx`) avec filtres par contrat, par source (dont bouton LinkedIn) et par techno.
  - **Module Baromètre des Compétences Clés (`components/SkillsRadar.tsx`, `lib/skills-analyzer.ts`)** alimenté par les 178 offres réelles.
  - Serveur Next.js actif sur `http://localhost:3002`.

---

## 5. Prochaines Étapes

1. **Activation de l'Ingestion :**
   - Renseigner `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local` pour insérer les 15+ offres réelles de Remotive dans Supabase.
2. **Ajout de sources supplémentaires :**
   - Connecteurs pour d'autres flux ouverts (ex: WeLoveDevs RSS, France Travail API).
3. **Système d'Alertes Temps Réel :**
   - Implémentation du Web Push API (Service Worker) pour notifier l'utilisateur dès qu'une offre correspondant à ses filtres est détectée.


