import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { enrichJob, type EnrichmentInput } from '@/lib/enrichment/index';

// ── Chargement de l'environnement ─────────────────────────────────────────────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
    if (!process.env[key.trim()]) process.env[key.trim()] = value;
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Identifiants Supabase introuvables dans .env.local');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

// ── Config ────────────────────────────────────────────────────────────────────

const BATCH_SIZE = parseInt(process.env.ENRICH_BATCH_SIZE ?? '50', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';

// ── Pipeline ───────────────────────────────────────────────────────────────────

async function fetchUnenrichedJobs(limit: number): Promise<EnrichmentInput[]> {
  const { data, error } = await db
    .from('jobs')
    .select('id, title, company_name, description, location, contract_type, remote_policy, salary_min, salary_max, salary_period, currency, tags')
    .is('enriched_at', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Fetch failed: ${error.message}`);
  return (data ?? []) as EnrichmentInput[];
}

async function persistEnrichment(
  jobId: string,
  enrichment: Record<string, unknown>,
): Promise<void> {
  const { error: upsertError } = await db
    .from('job_enrichments')
    .upsert({ ...enrichment }, { onConflict: 'job_id' });

  if (upsertError) throw new Error(`Upsert enrichment failed: ${upsertError.message}`);

  const { error: updateError } = await db
    .from('jobs')
    .update({ enriched_at: new Date().toISOString() })
    .eq('id', jobId);

  if (updateError) throw new Error(`Update jobs.enriched_at failed: ${updateError.message}`);
}

async function run() {
  console.log('='.repeat(60));
  console.log('🔬 PIPELINE D\'ENRICHISSEMENT DES OFFRES');
  console.log(`   Batch : ${BATCH_SIZE} offres | Mode : ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  const jobs = await fetchUnenrichedJobs(BATCH_SIZE);
  console.log(`\n📋 ${jobs.length} offre(s) à enrichir trouvées.\n`);

  if (jobs.length === 0) {
    console.log('✅ Rien à faire. Toutes les offres actives sont déjà enrichies.');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const [index, job] of jobs.entries()) {
    process.stdout.write(`[${index + 1}/${jobs.length}] "${job.title}" (${job.company_name})... `);

    const result = await enrichJob(job, db);

    if (!result.success || !result.enrichment) {
      console.log(`❌ ${result.error}`);
      errorCount++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`✔ (dry run) ESN=${result.enrichment.company_category} seniority=${result.enrichment.seniority} salary≈${result.enrichment.salary_estimated_median ?? '?'}€`);
    } else {
      try {
        await persistEnrichment(job.id, result.enrichment as never);
        console.log(`✔ ESN=${result.enrichment.company_category} seniority=${result.enrichment.seniority} salary≈${result.enrichment.salary_estimated_median ?? '?'}€`);
        successCount++;
      } catch (err) {
        console.log(`❌ persist: ${err instanceof Error ? err.message : err}`);
        errorCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🎉 Enrichissement terminé : ${successCount} succès, ${errorCount} erreurs.`);
  console.log('='.repeat(60));
}

run().catch((err) => {
  console.error('💥 Erreur fatale :', err);
  process.exit(1);
});
