export type SeniorityLevel = 'junior' | 'confirmed' | 'senior' | 'lead' | 'staff' | 'manager';

export type RemotePolicyParsed = 'full_remote' | 'hybrid' | 'onsite' | 'remote_friendly';

export type CompanyCategory =
  | 'esn_ssii'
  | 'cabinet_conseil'
  | 'editeur_produit'
  | 'scale_up'
  | 'startup'
  | 'grand_groupe'
  | 'eti'
  | 'secteur_public'
  | 'autre';

export type EnrichmentMethod = 'reference_table' | 'heuristic' | 'llm' | 'corpus_db' | 'benchmark' | 'insee_api' | 'title' | 'description' | 'default';

// ── Résultats par module ──────────────────────────────────────────────────────

export interface NormalizationResult {
  title_canonical: string | null;
  title_canonical_confidence: number;
  seniority: SeniorityLevel | null;
  seniority_confidence: number;
  seniority_method: EnrichmentMethod;
  remote_policy_parsed: RemotePolicyParsed | null;
  remote_days_onsite: number | null;
  remote_policy_confidence: number;
  location_city: string | null;
  location_region: string | null;
  location_country: string | null;
  location_lat: number | null;
  location_lon: number | null;
  tech_stack: string[];
  dedup_key: string | null;
}

export interface ESNClassificationResult {
  company_category: CompanyCategory;
  company_category_confidence: number;
  company_category_method: EnrichmentMethod;
}

export interface SalaryEstimateResult {
  salary_estimated_min: number | null;
  salary_estimated_max: number | null;
  salary_estimated_median: number | null;
  salary_estimated_currency: string;
  salary_estimated_period: 'yearly' | 'daily';
  salary_geo_base: string;
  salary_sample_size: number;
  salary_confidence: number;
  salary_data_source: string;
}

export interface EmployerSignalsResult {
  employer_repost_count: number;
  employer_open_positions: number;
  employer_trustpilot_score: number | null;
  employer_trustpilot_reviews: number | null;
  employer_signals_confidence: number;
}

export interface LocalContextData {
  similar_jobs_count: number;
  ecosystem_note: string | null;
  avg_salary_region: number | null;
  geo_multiplier: number;
}

export interface LocalContextResult {
  local_context: LocalContextData | null;
}

// ── Enregistrement enrichissement complet ─────────────────────────────────────

export interface JobEnrichment
  extends NormalizationResult,
    ESNClassificationResult,
    SalaryEstimateResult,
    EmployerSignalsResult,
    LocalContextResult {
  job_id: string;
  enrichment_version: string;
  enriched_at: string;
}

// ── JobOffer enrichie (vue complète pour le frontend) ─────────────────────────

export interface JobOfferEnriched {
  id: string;
  title: string;
  company_name: string;
  company_logo_url: string | null;
  location: string | null;
  contract_type: string;
  remote_policy: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  currency: string;
  description: string | null;
  tags: string[];
  source_name: string;
  source_url: string;
  fingerprint: string;
  is_active: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
  slug: string | null;
  enriched_at: string | null;
  enrichment?: JobEnrichment | null;
}
