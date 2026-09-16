# Guide de Style & Conventions de Développement (CLAUDE.md)

Ce document régit les standards de développement, l'architecture et les conventions de code pour le projet d'agrégation d'offres Tech & Freelance ("Jinka pour l'emploi").

---

## 1. Commandes Principales

| Action | Commande | Description |
| :--- | :--- | :--- |
| **Installation** | `npm install` | Installe l'ensemble des dépendances du projet |
| **Serveur de dev** | `npm run dev` | Démarre le serveur local Next.js sur `http://localhost:3000` |
| **Build de production** | `npm run build` | Compile et optimise l'application pour la production |
| **Démarrage production** | `npm run start` | Lance le serveur avec le bundle compilé |
| **Linting & Formatage** | `npm run lint` | Analyse statique avec ESLint / vérification des règles |
| **Tests** | `npm run test` | Exécute la suite de tests unitaires et d'intégration |
| **Ingestion manuelle** | `npm run jobs:ingest` | Exécute le script d'ingestion/test des offres d'emploi |

---

## 2. Style de Code & Conventions

### TypeScript Strict
- **Mode strict activé :** Aucun type `any` toléré sans justification explicite et temporaire (`unknown` privilégié si type incertain).
- **Typage explicite :** Toutes les signatures de fonctions, retours de fonctions, props de composants et réponses d'API doivent être typées.
- Les interfaces et types de données métier doivent résider dans `@/types/` (ex: `JobOffer`, `Company`, `FilterState`).

### Structure des Composants React
- Utilisation exclusive des **composants fonctionnels**.
- **Server Components par défaut :** Tous les composants dans le dossier `app/` sont des React Server Components (RSC) sauf nécessité absolue d'interactivité.
- **Client Components (`'use client'`) :** Réservés aux formulaires interactifs, gestionnaires d'état local (filtres réactifs, toggles), hooks de navigation côté client ou APIs navigateur (Web Push, LocalStorage).

### Organisation des Imports
Les imports doivent être organisés et regroupés par blocs distincts avec une ligne vide entre chaque groupe :
```typescript
// 1. Dépendances externes (React, Next.js, packages tiers)
import { Suspense } from 'react';
import Image from 'next/image';

// 2. Modules internes et alias (@/...)
import { createServerClient } from '@/lib/supabase/server';
import { JobCard } from '@/components/jobs/JobCard';
import type { JobOffer } from '@/types/job';

// 3. Utilitaires et constantes
import { formatDate } from '@/lib/utils';
import { CONTRACT_TYPES } from '@/constants/filters';

// 4. Styles ou assets relatifs (si applicable)
import './styles.css';
```

---

## 3. Workflow Git

### Conventional Commits
Chaque message de commit doit respecter scrupuleusement la spécification **Conventional Commits** :
`<type>(<portée optionnelle>): <description courte à l'impératif>`

Types acceptés :
- `feat:` : Ajout d'une nouvelle fonctionnalité utilisateur ou système.
- `fix:` : Correction d'un bug.
- `chore:` : Tâches de maintenance, mise à jour de dépendances, configuration tooling.
- `docs:` : Documentation uniquement (`README`, guides, `MEMORY.md`).
- `style:` : Formatage, point-virgules manquants, sans impact logique.
- `refactor:` : Refactorisation de code sans changement fonctionnel ni correctif de bug.
- `test:` : Ajout ou modification de tests unitaires/intégration.
- `perf:` : Amélioration des performances.

*Exemple :* `feat(jobs): add RSS feed parser for WeLoveDevs`

### Gestion des Branches
- `main` : Branche de production, toujours stable et déployable.
- `develop` : Branche d'intégration des fonctionnalités validées.
- `feat/<nom-feature>` : Nouvelle fonctionnalité (ex: `feat/job-card-ui`, `feat/supabase-schema`).
- `fix/<nom-bug>` : Correction de bug (ex: `fix/deduplication-hash`).

---

## 4. Sécurité & Performance

### Sécurité & Gestion des Secrets
- **Zéro secret dans le code source :** Aucune clé d'API, token ou chaîne de connexion en clair dans les fichiers trackés.
- Variables publiques : Préfixées obligatoirement par `NEXT_PUBLIC_` (ex: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Variables secrètes serveur : Sans préfixe public (ex: `SUPABASE_SERVICE_ROLE_KEY`), accessibles uniquement dans les Server Components, Route Handlers et Edge Functions.
- Le fichier `.env.local` ne doit **jamais** être commité.

### Approche Mobile-First avec Tailwind CSS
- **Mobile-First obligatoire :** La base des classes CSS s'applique aux écrans mobiles (< 640px). L'adaptation aux tablettes et desktops se fait via les modificateurs progressifs : `sm:`, `md:`, `lg:`, `xl:`.
- Respect du design system et de la cohérence visuelle : variables HSL Tailwind, palette sobre et moderne, contrastes accessibles (WCAG AA).
- Priorité à la rapidité de scan des offres (ergonomie similaire aux applications d'annonces immobilières type Jinka).

### Optimisation Server Components vs Client Components
- **Data Fetching côté serveur :** Les requêtes vers Supabase ou les APIs de jobs doivent être exécutées au maximum côté serveur pour réduire le JavaScript client et éviter les cascades de requêtes (waterfalls).
- **Streaming & Suspense :** Encapsuler les listes d'offres et composants asynchrones dans `<Suspense fallback={<JobCardSkeleton />}>` pour un premier affichage instantané.
- **Images optimisées :** Utilisation systématique de `next/image` pour les logos d'entreprises avec dimensions spécifiées et lazy-loading automatique.
