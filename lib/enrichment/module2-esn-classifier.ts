import type { ESNClassificationResult, CompanyCategory, EnrichmentMethod } from '@/types/enrichment';
import esnListRaw from '@/config/esn-list.json';

const esnList = esnListRaw as Record<string, unknown>;

// ── Préparation des listes de référence ──────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLegalSuffix(name: string): string {
  return normalize(name)
    .replace(
      /\s+(sa|sas|sasu|sarl|eurl|scp|sci|snc|se|nv|ag|gmbh|ltd|inc|llc|bv|plc|spa|oy)\s*$/i,
      '',
    )
    .replace(/\s+group(e)?$/, '')
    .trim();
}

const esnNormalized = new Set<string>(
  (esnList['esn_ssii'] as string[]).map(stripLegalSuffix),
);
const consultingNormalized = new Set<string>(
  (esnList['cabinet_conseil'] as string[]).map(stripLegalSuffix),
);
const publicNormalized = new Set<string>(
  (esnList['secteur_public'] as string[]).map(normalize),
);
const productSignals = new Set<string>(
  (esnList['known_product_signals'] as string[]).map(normalize),
);

// ── Heuristiques sur la description ──────────────────────────────────────────

// Signaux forts ESN : mentions de mise à disposition chez un client
const ESN_STRONG: RegExp[] = [
  /\b(chez\s+(?:nos|un|notre)\s+client[s]?)\b/i,
  /\b(en\s+r[eé]gie)\b/i,
  /\b(prestation[s]?\s+(?:de\s+service|informatique))\b/i,
  /\b(mission[s]?\s+(?:chez|au\s+sein|pour)\s+(?:nos|un|notre|des)\s+client)\b/i,
  /\b(au\s+sein\s+(?:de\s+)?(?:notre\s+)?[eé]quipe\s+de\s+consultant)\b/i,
  /\b(nos\s+consultant[e]?s?\s+interviennent)\b/i,
  /\b(d[eé]tachement|portage\s+salarial)\b/i,
];

// Signaux faibles ESN
const ESN_WEAK: RegExp[] = [
  /\b(consultant[e]?[s]?)\b/i,
  /\b(t[jt]m|tarif\s+jour(?:nalier)?)\b/i,
  /\b(int[eé]grateur|int[eé]gration\s+de\s+solution)\b/i,
];

// Signaux produit
const PRODUCT_STRONG: RegExp[] = [
  /\b(notre\s+(?:produit|application|plateforme|logiciel|solution\s+saas))\b/i,
  /\b(on\s+construit|nous\s+construisons|nous\s+d[eé]veloppons)\s+(?:notre|un)\b/i,
  /\b(product[\s-]led|product\s+company|saas)\b/i,
  /\b(notre\s+(?:codebase|stack|app|api))\b/i,
];

const STARTUP_SIGNALS: RegExp[] = [
  /\b(lev[eé]e\s+de\s+fonds|s[eé]rie\s+[abc]|seed[s]?|pre[\s-]seed|venture)\b/i,
  /\b(startup|start[\s-]up|scale[\s-]up)\b/i,
];

const PUBLIC_SIGNALS: RegExp[] = [
  /\b(fonction\s+publique|service\s+public|administration|collectivit[eé])\b/i,
  /\b(march[eé]\s+public|appel\s+d.offre)\b/i,
];

// ── Logique de classification ─────────────────────────────────────────────────

function scoreDescription(description: string): {
  esnScore: number;
  productScore: number;
  publicScore: number;
  startupScore: number;
} {
  const text = normalize(description.slice(0, 4000));
  let esnScore = 0;
  let productScore = 0;
  let publicScore = 0;
  let startupScore = 0;

  for (const pat of ESN_STRONG) if (pat.test(text)) esnScore += 3;
  for (const pat of ESN_WEAK) if (pat.test(text)) esnScore += 1;
  for (const pat of PRODUCT_STRONG) if (pat.test(text)) productScore += 2;
  for (const pat of STARTUP_SIGNALS) if (pat.test(text)) startupScore += 2;
  for (const pat of PUBLIC_SIGNALS) if (pat.test(text)) publicScore += 2;

  return { esnScore, productScore, publicScore, startupScore };
}

// ── Point d'entrée du module ──────────────────────────────────────────────────

export interface ESNClassifierInput {
  company_name: string;
  description: string | null;
}

export function runModule2(input: ESNClassifierInput): ESNClassificationResult {
  const { company_name, description = '' } = input;
  const normalizedCompany = stripLegalSuffix(company_name);

  // 1. Table de référence — confiance maximale
  if (esnNormalized.has(normalizedCompany)) {
    return { company_category: 'esn_ssii', company_category_confidence: 0.97, company_category_method: 'reference_table' };
  }
  if (consultingNormalized.has(normalizedCompany)) {
    return { company_category: 'cabinet_conseil', company_category_confidence: 0.97, company_category_method: 'reference_table' };
  }
  // Correspondance partielle sur les SSII connues (cas "Capgemini Engineering" non listé)
  for (const esn of esnNormalized) {
    if (normalizedCompany.startsWith(esn) || esn.startsWith(normalizedCompany)) {
      return { company_category: 'esn_ssii', company_category_confidence: 0.88, company_category_method: 'reference_table' };
    }
  }

  // Produits connus
  for (const signal of productSignals) {
    if (normalizedCompany.includes(signal) || signal.includes(normalizedCompany)) {
      return { company_category: 'editeur_produit', company_category_confidence: 0.90, company_category_method: 'reference_table' };
    }
  }

  // Signaux secteur public
  for (const signal of publicNormalized) {
    if (normalizedCompany.includes(signal)) {
      return { company_category: 'secteur_public', company_category_confidence: 0.85, company_category_method: 'reference_table' };
    }
  }

  // 2. Heuristiques sur la description
  const { esnScore, productScore, publicScore, startupScore } = scoreDescription(description ?? '');

  if (publicScore >= 2) {
    return { company_category: 'secteur_public', company_category_confidence: 0.72, company_category_method: 'heuristic' };
  }

  if (esnScore >= 3) {
    return { company_category: 'esn_ssii', company_category_confidence: 0.78, company_category_method: 'heuristic' };
  }

  if (startupScore >= 2) {
    const category: CompanyCategory = productScore >= 2 ? 'scale_up' : 'startup';
    return { company_category: category, company_category_confidence: 0.65, company_category_method: 'heuristic' };
  }

  if (productScore >= 2) {
    return { company_category: 'editeur_produit', company_category_confidence: 0.62, company_category_method: 'heuristic' };
  }

  if (esnScore >= 1) {
    return { company_category: 'esn_ssii', company_category_confidence: 0.50, company_category_method: 'heuristic' };
  }

  // 3. Repli : catégorie inconnue avec confiance basse
  return { company_category: 'autre', company_category_confidence: 0.30, company_category_method: 'heuristic' };
}
