import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmployerSignalsResult } from '@/types/enrichment';

// ── Signaux internes ───────────────────────────────────────────────────────────

async function countOpenPositions(db: SupabaseClient, companyName: string): Promise<number> {
  const { count, error } = await db
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .ilike('company_name', companyName)
    .eq('is_active', true);

  if (error) return 0;
  return count ?? 0;
}

async function countRecentReposts(
  db: SupabaseClient,
  companyName: string,
  titleCanonical: string | null,
): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let query = db
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .ilike('company_name', companyName)
    .gte('created_at', thirtyDaysAgo);

  if (titleCanonical) {
    // Proxy : filtre sur les tags qui incluent le canonical slug
    const titleWords = titleCanonical.replace(/_/g, ' ');
    query = query.ilike('title', `%${titleWords}%`);
  }

  const { count, error } = await query;
  if (error) return 0;
  return Math.max(0, (count ?? 1) - 1); // -1 car l'offre courante compte
}

// ── Trustpilot (stub) ─────────────────────────────────────────────────────────
// TODO: intégrer l'API Trustpilot Business lorsque la clé sera disponible.
// Endpoint : GET https://api.trustpilot.com/v1/business-units/find?name={company}
// Retourne : score, numberOfReviews, trustScore, stars

async function fetchTrustpilotData(
  _companyName: string,
): Promise<{ score: number | null; reviews: number | null }> {
  return { score: null, reviews: null };
}

// ── Calcul du score de confiance des signaux ──────────────────────────────────

function computeSignalsConfidence(
  openPositions: number,
  repostCount: number,
  hasTrustpilot: boolean,
): number {
  // Les signaux internes existent toujours, confidence de base 0.60
  let confidence = 0.60;
  if (hasTrustpilot) confidence += 0.25;
  if (openPositions > 5) confidence += 0.10;
  return Math.min(confidence, 0.95);
}

// ── Point d'entrée du module ───────────────────────────────────────────────────

export interface EmployerSignalsInput {
  company_name: string;
  title_canonical: string | null;
}

export async function runModule4(
  input: EmployerSignalsInput,
  db: SupabaseClient,
): Promise<EmployerSignalsResult> {
  const [openPositions, repostCount, trustpilot] = await Promise.all([
    countOpenPositions(db, input.company_name),
    countRecentReposts(db, input.company_name, input.title_canonical),
    fetchTrustpilotData(input.company_name),
  ]);

  const hasTrustpilot = trustpilot.score !== null;
  const confidence = computeSignalsConfidence(openPositions, repostCount, hasTrustpilot);

  return {
    employer_repost_count: repostCount,
    employer_open_positions: openPositions,
    employer_trustpilot_score: trustpilot.score,
    employer_trustpilot_reviews: trustpilot.reviews,
    employer_signals_confidence: confidence,
  };
}
