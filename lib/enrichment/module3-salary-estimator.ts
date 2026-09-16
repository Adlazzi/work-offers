import type { SupabaseClient } from '@supabase/supabase-js';
import type { SalaryEstimateResult } from '@/types/enrichment';
import type { SeniorityLevel } from '@/types/enrichment';
import benchmarksRaw from '@/config/salary-benchmarks.json';

const benchmarks = benchmarksRaw as Record<string, unknown>;
const geoMultipliers = benchmarks['geo_multipliers'] as Record<string, number>;
const cdiBenchmarks = benchmarks['cdi'] as Record<string, Record<string, { p25: number; p50: number; p75: number }>>;
const freelanceBenchmarks = benchmarks['freelance'] as Record<string, Record<string, { p25: number; p50: number; p75: number }>>;
const BENCHMARK_SOURCE = (benchmarks['_meta'] as Record<string, string>)['label_display'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function getGeoMultiplier(region: string | null, city: string | null): { multiplier: number; geoBase: string } {
  const candidates = [city, region].map((s) => s?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() ?? '');

  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const [key, multiplier] of Object.entries(geoMultipliers)) {
      if (candidate.includes(key) || key.includes(candidate)) {
        return { multiplier, geoBase: city ?? region ?? 'France' };
      }
    }
  }
  return { multiplier: geoMultipliers['default'] ?? 0.92, geoBase: 'France' };
}

function applyGeoMultiplier(
  p25: number,
  p50: number,
  p75: number,
  multiplier: number,
): { min: number; median: number; max: number } {
  return {
    min: Math.round(p25 * multiplier),
    median: Math.round(p50 * multiplier),
    max: Math.round(p75 * multiplier),
  };
}

// ── Lecture corpus réel depuis la base ────────────────────────────────────────

interface SalaryRow { salary_min: number; salary_max: number }

async function fetchCorpusStats(
  db: SupabaseClient,
  titleCanonical: string,
  seniority: SeniorityLevel,
  contractType: 'cdi' | 'freelance',
  region: string | null,
): Promise<{ p25: number; p50: number; p75: number; n: number } | null> {
  // Cherche les offres avec salaire renseigné pour ce segment
  let query = db
    .from('jobs')
    .select('salary_min, salary_max')
    .eq('is_active', true)
    .eq('contract_type', contractType)
    .not('salary_min', 'is', null)
    .not('salary_max', 'is', null)
    .limit(500);

  // Filtre sur le titre canonique via les tags (proxy imparfait mais dispo sans JOIN)
  if (titleCanonical) {
    query = query.contains('tags', [titleCanonical.replace('_', ' ')]);
  }

  const { data, error } = await query;
  if (error || !data || data.length < 5) return null;

  const values = (data as SalaryRow[])
    .map((r) => (r.salary_min + r.salary_max) / 2)
    .sort((a, b) => a - b);

  const n = values.length;
  if (n < 5) return null;

  const p25 = values[Math.floor(n * 0.25)];
  const p50 = values[Math.floor(n * 0.50)];
  const p75 = values[Math.floor(n * 0.75)];

  return { p25, p50, p75, n };
}

// ── Hiérarchie de repli benchmark ─────────────────────────────────────────────

function lookupBenchmark(
  contractType: 'cdi' | 'freelance',
  titleCanonical: string | null,
  seniority: SeniorityLevel,
): { p25: number; p50: number; p75: number } | null {
  if (!titleCanonical) return null;
  const table = contractType === 'cdi' ? cdiBenchmarks : freelanceBenchmarks;
  const byRole = table[titleCanonical];
  if (!byRole) return null;
  // Repli séniorité si le niveau exact est absent
  const fallbacks: SeniorityLevel[] = [seniority, 'confirmed', 'senior', 'junior'];
  for (const lvl of fallbacks) {
    if (byRole[lvl]) return byRole[lvl];
  }
  return null;
}

// ── Point d'entrée du module ───────────────────────────────────────────────────

export interface SalaryEstimatorInput {
  title_canonical: string | null;
  seniority: SeniorityLevel | null;
  contract_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  currency: string;
  location_region: string | null;
  location_city: string | null;
}

export async function runModule3(
  input: SalaryEstimatorInput,
  db: SupabaseClient,
): Promise<SalaryEstimateResult> {
  const contractType = input.contract_type === 'freelance' ? 'freelance' : 'cdi';
  const seniority: SeniorityLevel = (input.seniority as SeniorityLevel) ?? 'confirmed';
  const { multiplier, geoBase } = getGeoMultiplier(input.location_region, input.location_city);

  // Si le salaire est déjà renseigné, on ne l'écrase pas mais on retourne quand même les métadonnées
  if (input.salary_min !== null && input.salary_max !== null && input.currency === 'EUR') {
    const period = (contractType === 'freelance' ? 'daily' : 'yearly') as 'yearly' | 'daily';
    return {
      salary_estimated_min: input.salary_min,
      salary_estimated_max: input.salary_max,
      salary_estimated_median: Math.round((input.salary_min + input.salary_max) / 2),
      salary_estimated_currency: 'EUR',
      salary_estimated_period: period,
      salary_geo_base: geoBase,
      salary_sample_size: -1, // -1 = valeur réelle, pas estimée
      salary_confidence: 0.99,
      salary_data_source: 'source_annonce',
    };
  }

  // 1. Corpus réel de la base (≥ 5 offres pour le segment)
  try {
    const corpus = await fetchCorpusStats(db, input.title_canonical ?? '', seniority, contractType, input.location_region);
    if (corpus && corpus.n >= 20) {
      const { min, median, max } = applyGeoMultiplier(corpus.p25, corpus.p50, corpus.p75, multiplier);
      return {
        salary_estimated_min: min,
        salary_estimated_max: max,
        salary_estimated_median: median,
        salary_estimated_currency: 'EUR',
        salary_estimated_period: contractType === 'freelance' ? 'daily' : 'yearly',
        salary_geo_base: geoBase,
        salary_sample_size: corpus.n,
        salary_confidence: 0.82,
        salary_data_source: `corpus_db (${corpus.n} offres)`,
      };
    }
    if (corpus && corpus.n >= 5) {
      const { min, median, max } = applyGeoMultiplier(corpus.p25, corpus.p50, corpus.p75, multiplier);
      return {
        salary_estimated_min: min,
        salary_estimated_max: max,
        salary_estimated_median: median,
        salary_estimated_currency: 'EUR',
        salary_estimated_period: contractType === 'freelance' ? 'daily' : 'yearly',
        salary_geo_base: geoBase,
        salary_sample_size: corpus.n,
        salary_confidence: 0.62,
        salary_data_source: `corpus_db (${corpus.n} offres — échantillon limité)`,
      };
    }
  } catch {
    // corpus DB indisponible, on passe au benchmark
  }

  // 2. Grille benchmark SalaireTech
  const bench = lookupBenchmark(contractType, input.title_canonical, seniority);
  if (bench) {
    const { min, median, max } = applyGeoMultiplier(bench.p25, bench.p50, bench.p75, multiplier);
    return {
      salary_estimated_min: min,
      salary_estimated_max: max,
      salary_estimated_median: median,
      salary_estimated_currency: 'EUR',
      salary_estimated_period: contractType === 'freelance' ? 'daily' : 'yearly',
      salary_geo_base: geoBase,
      salary_sample_size: 0,
      salary_confidence: 0.40,
      salary_data_source: BENCHMARK_SOURCE,
    };
  }

  // 3. Aucune estimation possible
  return {
    salary_estimated_min: null,
    salary_estimated_max: null,
    salary_estimated_median: null,
    salary_estimated_currency: 'EUR',
    salary_estimated_period: contractType === 'freelance' ? 'daily' : 'yearly',
    salary_geo_base: geoBase,
    salary_sample_size: 0,
    salary_confidence: 0,
    salary_data_source: 'unavailable',
  };
}
