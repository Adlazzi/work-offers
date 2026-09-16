import type { JobEnrichment } from '@/types/enrichment';

// Contrainte Google : tout ce qui est dans le JSON-LD doit être visible sur la page.
// Ce générateur retourne uniquement les champs dont on sait qu'ils sont affichés
// dans le composant JobDetailModal (description originale, localisation, contrat, salaire).

export interface JobForJsonLd {
  id: string;
  title: string;
  company_name: string;
  company_logo_url: string | null;
  location: string | null;
  description: string | null;
  contract_type: string;
  published_at: string;
  source_url: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  currency: string;
  slug: string | null;
}

function mapEmploymentType(contractType: string): string {
  const map: Record<string, string> = {
    cdi: 'FULL_TIME',
    cdd: 'TEMPORARY',
    freelance: 'CONTRACTOR',
    stage: 'INTERN',
    alternance: 'PART_TIME',
  };
  return map[contractType] ?? 'OTHER';
}

function buildSalarySpec(
  min: number | null,
  max: number | null,
  period: string | null,
  currency: string,
  isEstimated: boolean,
): Record<string, unknown> | null {
  const value = min ?? max;
  if (value === null) return null;

  const unitMap: Record<string, string> = {
    yearly: 'YEAR',
    monthly: 'MONTH',
    daily: 'DAY',
    hourly: 'HOUR',
  };

  const spec: Record<string, unknown> = {
    '@type': 'MonetaryAmountDistribution',
    name: isEstimated ? 'Salaire estimé' : 'Salaire',
    currency,
    duration: `P1${unitMap[period ?? 'yearly']?.[0] ?? 'Y'}`,
    minValue: min ?? undefined,
    maxValue: max ?? undefined,
    median: min && max ? Math.round((min + max) / 2) : undefined,
  };

  return { '@type': 'MonetaryAmount', value: spec };
}

function buildEstimatedSalarySpec(enrichment: JobEnrichment): Record<string, unknown> | null {
  if (!enrichment.salary_estimated_median) return null;

  const period = enrichment.salary_estimated_period ?? 'yearly';
  const unitMap: Record<string, string> = { yearly: 'YEAR', monthly: 'MONTH', daily: 'DAY', hourly: 'HOUR' };

  return {
    '@type': 'MonetaryAmountDistribution',
    name: 'Salaire estimé',
    currency: enrichment.salary_estimated_currency ?? 'EUR',
    duration: `P1${unitMap[period]?.[0] ?? 'Y'}`,
    minValue: enrichment.salary_estimated_min ?? undefined,
    maxValue: enrichment.salary_estimated_max ?? undefined,
    median: enrichment.salary_estimated_median,
  };
}

export function generateJobPostingJsonLd(
  job: JobForJsonLd,
  enrichment: JobEnrichment | null | undefined,
): Record<string, unknown> {
  const city = enrichment?.location_city ?? job.location;
  const country = enrichment?.location_country ?? 'FR';
  const region = enrichment?.location_region;

  const isRemote =
    enrichment?.remote_policy_parsed === 'full_remote' ||
    job.contract_type === 'freelance';

  // Construction de jobLocation — doit correspondre exactement à ce qui est affiché
  const jobLocation: Record<string, unknown>[] = [];
  if (city || job.location) {
    jobLocation.push({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: city ?? job.location,
        addressRegion: region ?? undefined,
        addressCountry: country,
      },
    });
  }
  if (isRemote) {
    jobLocation.push({ '@type': 'VirtualLocation' });
  }

  // Expiration : 60 jours après publication par défaut
  const published = new Date(job.published_at);
  const validThrough = new Date(published.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();

  // Salaire : réel si présent, estimé sinon (avec label explicite)
  const hasRealSalary = job.salary_min !== null && job.salary_max !== null && job.currency === 'EUR';
  const salarySpec = hasRealSalary
    ? buildSalarySpec(job.salary_min, job.salary_max, job.salary_period, job.currency, false)
    : enrichment
      ? buildEstimatedSalarySpec(enrichment)
      : null;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description ?? '',
    datePosted: job.published_at,
    validThrough,
    employmentType: mapEmploymentType(job.contract_type),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company_name,
      ...(job.company_logo_url ? { logo: job.company_logo_url } : {}),
    },
    ...(jobLocation.length > 0 ? { jobLocation: jobLocation.length === 1 ? jobLocation[0] : jobLocation } : {}),
    ...(isRemote ? { jobLocationType: 'TELECOMMUTE' } : {}),
    applyUrl: job.source_url,
    directApply: false,
  };

  // Salaire estimé : Google l'accepte mais exige qu'il soit visible sur la page
  if (salarySpec) {
    if (hasRealSalary) {
      jsonLd['baseSalary'] = salarySpec;
    } else {
      jsonLd['estimatedSalary'] = salarySpec;
    }
  }

  return jsonLd;
}

// Serialize to <script> tag content (safe for Next.js Script/dangerouslySetInnerHTML)
export function serializeJsonLd(jsonLd: Record<string, unknown>): string {
  return JSON.stringify(jsonLd, null, 2);
}
