import type { SupabaseClient } from '@supabase/supabase-js';
import type { JobEnrichment } from '@/types/enrichment';

import { runModule1, type RawJobInput } from './module1-normalizer';
import { runModule2 } from './module2-esn-classifier';
import { runModule3, type SalaryEstimatorInput } from './module3-salary-estimator';
import { runModule4 } from './module4-employer-signals';
import { runModule5 } from './module5-local-context';

export const ENRICHMENT_VERSION = '1.0';

export interface EnrichmentInput {
  id: string;
  title: string;
  company_name: string;
  description: string | null;
  location: string | null;
  contract_type: string;
  remote_policy: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  currency: string;
  tags: string[];
}

export interface EnrichmentRunResult {
  success: boolean;
  jobId: string;
  enrichment?: Omit<JobEnrichment, 'id'>;
  error?: string;
}

export async function enrichJob(
  job: EnrichmentInput,
  db: SupabaseClient,
): Promise<EnrichmentRunResult> {
  try {
    // Module 1 : normalisation (prérequis pour tous les autres)
    const m1 = await runModule1({
      title: job.title,
      company_name: job.company_name,
      description: job.description,
      location: job.location,
      tags: job.tags,
      remote_policy: job.remote_policy,
    } satisfies RawJobInput);

    // Modules 2, 3, 4, 5 en parallèle (indépendants une fois M1 calculé)
    const [m2, m3, m4, m5] = await Promise.all([
      Promise.resolve(
        runModule2({ company_name: job.company_name, description: job.description }),
      ),
      runModule3(
        {
          title_canonical: m1.title_canonical,
          seniority: m1.seniority,
          contract_type: job.contract_type,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
          salary_period: job.salary_period,
          currency: job.currency,
          location_region: m1.location_region,
          location_city: m1.location_city,
        } satisfies SalaryEstimatorInput,
        db,
      ),
      runModule4({ company_name: job.company_name, title_canonical: m1.title_canonical }, db),
      runModule5(
        {
          location_city: m1.location_city,
          location_region: m1.location_region,
          title_canonical: m1.title_canonical,
        },
        db,
      ),
    ]);

    const enrichment: Omit<JobEnrichment, 'id'> = {
      job_id: job.id,
      // M1
      ...m1,
      // M2
      ...m2,
      // M3
      ...m3,
      // M4
      ...m4,
      // M5
      ...m5,
      enrichment_version: ENRICHMENT_VERSION,
      enriched_at: new Date().toISOString(),
    };

    return { success: true, jobId: job.id, enrichment };
  } catch (err) {
    return {
      success: false,
      jobId: job.id,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
