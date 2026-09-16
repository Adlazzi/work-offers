import type { SupabaseClient } from '@supabase/supabase-js';
import type { LocalContextResult, LocalContextData } from '@/types/enrichment';
import benchmarksRaw from '@/config/salary-benchmarks.json';

const benchmarks = benchmarksRaw as Record<string, unknown>;
const geoMultipliers = benchmarks['geo_multipliers'] as Record<string, number>;

// ── Notes d'écosystème tech par ville ─────────────────────────────────────────

const ECOSYSTEM_NOTES: Record<string, string> = {
  paris: "Premier hub tech et data en France, acces a un large vivier de talents et d'entreprises tech.",
  lyon: "Second pole numerique francais, fort tissu de scale-ups et de cabinets de conseil tech.",
  bordeaux: "Scene startup en forte croissance, specialisee IoT, cybersecurite et agritech.",
  nantes: "Ecosysteme numerique dynamique, hub reconnu pour les industries creatives et la deeptech.",
  toulouse: "Pole aeronautique et spatial de rang mondial, fort en embarque, IA et data.",
  lille: "Metropole en transformation numerique, forte en e-commerce, retail tech et IA appliquee.",
  rennes: "Berceau des telecoms et de la cybersecurite, riche en entreprises de la French Tech Rennes.",
  marseille: "Ecosysteme en emergence, dynamique sur la medtech, la logistique et la fintech.",
  montpellier: "Hub numerique mediterraneen, forte concentration de startups sante et EdTech.",
  strasbourg: "Pole transfrontalier FR/DE, fort en medtech, legaltech et projets europeens.",
  grenoble: "Ecosysteme deeptech et recherche, avec Minatec, CEA et un tissu semi-conducteurs dense.",
  sophia: "Technopole historique du numerique, specialisee R&D, cyber et solutions logicielles.",
};

// ── Données locales depuis la base ─────────────────────────────────────────────

async function countSimilarJobsInCity(
  db: SupabaseClient,
  city: string | null,
  titleCanonical: string | null,
): Promise<number> {
  if (!city) return 0;
  const { count, error } = await db
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .ilike('location', `%${city}%`)
    .eq('is_active', true);

  if (error) return 0;
  return count ?? 0;
}

// ── Salaire moyen régional via le corpus enrichi ───────────────────────────────

async function getRegionalSalaryAvg(
  db: SupabaseClient,
  region: string | null,
  titleCanonical: string | null,
): Promise<number | null> {
  if (!region || !titleCanonical) return null;

  const { data, error } = await db
    .from('job_enrichments')
    .select('salary_estimated_median')
    .not('salary_estimated_median', 'is', null)
    .ilike('location_region', `%${region}%`)
    .eq('title_canonical', titleCanonical)
    .limit(100);

  if (error || !data || data.length < 3) return null;

  const values = (data as { salary_estimated_median: number }[])
    .map((r) => r.salary_estimated_median)
    .filter(Boolean);

  if (values.length < 3) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// ── Multiplicateur géo ─────────────────────────────────────────────────────────

function getGeoMultiplier(city: string | null, region: string | null): number {
  const candidates = [city, region]
    .map((s) => s?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() ?? '')
    .filter(Boolean);

  for (const c of candidates) {
    for (const [key, val] of Object.entries(geoMultipliers)) {
      if (c.includes(key) || key.includes(c)) return val;
    }
  }
  return geoMultipliers['default'] ?? 0.92;
}

// ── Point d'entrée du module ───────────────────────────────────────────────────

export interface LocalContextInput {
  location_city: string | null;
  location_region: string | null;
  title_canonical: string | null;
}

export async function runModule5(
  input: LocalContextInput,
  db: SupabaseClient,
): Promise<LocalContextResult> {
  const { location_city, location_region, title_canonical } = input;

  const cityKey = location_city?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ?? null;
  const ecosystemNote = cityKey ? (ECOSYSTEM_NOTES[cityKey] ?? null) : null;
  const geoMultiplier = getGeoMultiplier(location_city, location_region);

  const [similarJobsCount, avgSalaryRegion] = await Promise.all([
    countSimilarJobsInCity(db, location_city, title_canonical),
    getRegionalSalaryAvg(db, location_region, title_canonical),
  ]);

  const contextData: LocalContextData = {
    similar_jobs_count: similarJobsCount,
    ecosystem_note: ecosystemNote,
    avg_salary_region: avgSalaryRegion,
    geo_multiplier: geoMultiplier,
  };

  return { local_context: contextData };
}
