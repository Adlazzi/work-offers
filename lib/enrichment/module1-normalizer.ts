import crypto from 'crypto';
import type { NormalizationResult, SeniorityLevel, RemotePolicyParsed, EnrichmentMethod } from '@/types/enrichment';

import titleMappingsRaw from '@/config/title-mappings.json';
import techDictionaryRaw from '@/config/tech-dictionary.json';

// ── Préparation des données de config ─────────────────────────────────────────

type TitleMappings = Record<string, string[]>;
const titleMappings = titleMappingsRaw as Record<string, unknown>;

// Index inversé : variante → canonical
const variantToCanonical = new Map<string, string>();
for (const [canonical, variants] of Object.entries(titleMappings)) {
  if (canonical.startsWith('_') || !Array.isArray(variants)) continue;
  for (const variant of variants as string[]) {
    variantToCanonical.set(normalize(variant), canonical);
  }
}

// Dictionnaire de technos : toutes les entrées dans un Set
const techDictionary = techDictionaryRaw as Record<string, unknown>;
const allTechnos = new Set<string>();
for (const [key, entries] of Object.entries(techDictionary)) {
  if (key.startsWith('_') || !Array.isArray(entries)) continue;
  for (const tech of entries as string[]) {
    allTechnos.add(tech.toLowerCase());
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire accents
    .replace(/\s+/g, ' ')
    .trim();
}

function stripGenderMention(title: string): string {
  return title
    .replace(/\s*[\(\[]?\s*[fhm]\/[fhm]\s*[\)\]]?\s*$/i, '')
    .replace(/\s*[\(\[]?\s*[fhm]-[fhm]\s*[\)\]]?\s*$/i, '')
    .replace(/\s*[\(\[]?\s*m\/w\/d\s*[\)\]]?\s*$/i, '')
    .replace(/\s*[\(\[]?\s*homme\s*\/\s*femme\s*[\)\]]?\s*$/i, '')
    .trim();
}

const SENIORITY_PATTERNS: Array<{
  level: SeniorityLevel;
  titlePatterns: RegExp[];
  descriptionPatterns: RegExp[];
}> = [
  {
    level: 'manager',
    titlePatterns: [/\b(head of|manager|directeur|director|vp |cto|cpo)\b/i],
    descriptionPatterns: [/\b(manage|diriger|encadrer)\s+(une\s+)?[eé]quipe\b/i],
  },
  {
    level: 'staff',
    titlePatterns: [/\b(staff|principal)\b/i],
    descriptionPatterns: [],
  },
  {
    level: 'lead',
    titlePatterns: [/\b(lead|tech lead|technical lead|lead [a-z]+)\b/i],
    descriptionPatterns: [/\b(lead|animer|piloter)\s+(une\s+)?[eé]quipe\b/i],
  },
  {
    level: 'senior',
    titlePatterns: [/\b(senior|sr\.?|experienced|confirmé|exper[it])\b/i],
    descriptionPatterns: [/\b([5-9]\d*\s*(?:\+\s*)?(?:ans|years)|exp[ée]rience\s+(?:de\s+)?[5-9]\d*)\b/i],
  },
  {
    level: 'confirmed',
    titlePatterns: [/\b(confirm[eé]|mid[\s-]?level|intermediaire|intermédiaire)\b/i],
    descriptionPatterns: [/\b([2-4]\s*(?:à|a|-)\s*[4-6]\s*(?:ans|years)|exp[ée]rience\s+(?:de\s+)?[2-5])\b/i],
  },
  {
    level: 'junior',
    titlePatterns: [/\b(junior|jr\.?|[eé]tudiant|graduate|stage|intern|d[eé]butant)\b/i],
    descriptionPatterns: [/\b(0\s*[àa]\s*[12]\s*(?:ans|years)|d[eé]butant|premi[eè]re\s+exp[ée]rience)\b/i],
  },
];

export function detectSeniority(
  title: string,
  description: string
): { level: SeniorityLevel; confidence: number; method: EnrichmentMethod } {
  const normTitle = normalize(title);
  const normDesc = normalize(description.slice(0, 2000));

  for (const { level, titlePatterns, descriptionPatterns } of SENIORITY_PATTERNS) {
    for (const pat of titlePatterns) {
      if (pat.test(normTitle)) return { level, confidence: 0.90, method: 'title' };
    }
  }
  for (const { level, descriptionPatterns } of SENIORITY_PATTERNS) {
    for (const pat of descriptionPatterns) {
      if (pat.test(normDesc)) return { level, confidence: 0.70, method: 'description' };
    }
  }
  return { level: 'confirmed', confidence: 0.30, method: 'default' };
}

export function normalizeTitle(
  rawTitle: string
): { canonical: string | null; confidence: number } {
  const cleaned = normalize(stripGenderMention(rawTitle));

  // Correspondance exacte
  if (variantToCanonical.has(cleaned)) {
    return { canonical: variantToCanonical.get(cleaned)!, confidence: 0.95 };
  }

  // Correspondance partielle : cherche si un variant connu est contenu dans le titre
  for (const [variant, canonical] of variantToCanonical) {
    if (cleaned.includes(variant) && variant.length > 6) {
      return { canonical, confidence: 0.75 };
    }
  }

  // Repli : prendre les 3 premiers mots significatifs comme slug
  const slug = cleaned
    .replace(/\b(senior|junior|lead|staff|h\/f|f\/h|cdi|cdd|freelance)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join('_');

  return { canonical: slug || null, confidence: 0.35 };
}

// ── Remote policy ──────────────────────────────────────────────────────────────

const REMOTE_PATTERNS: Array<{
  policy: RemotePolicyParsed;
  patterns: RegExp[];
  extractDays?: RegExp;
  confidence: number;
}> = [
  {
    policy: 'full_remote',
    patterns: [
      /\b(100\s*%\s*(t[eé]l[eé]travail|remote)|full\s*remote|t[eé]l[eé]travail\s*complet|enti[eè]rement\s*[àa]\s*distance|fully\s*remote|remote\s*first|remote[- ]only)\b/i,
    ],
    confidence: 0.92,
  },
  {
    policy: 'hybrid',
    patterns: [
      /\b(\d+)\s*(?:jours?|days?)\s*(?:de\s*t[eé]l[eé]travail|[àa]\s*distance|remote|en\s*remote)\b/i,
      /\bt[eé]l[eé]travail\s*(\d+)\s*(?:jours?|days?)\b/i,
      /\b(hybride|hybrid|partiel|t[eé]l[eé]travail\s*partiel)\b/i,
    ],
    extractDays: /\b(\d+)\s*(?:jours?|days?)\s*(?:de\s*t[eé]l[eé]travail|[àa]\s*distance|remote|en\s*remote)\b/i,
    confidence: 0.82,
  },
  {
    policy: 'onsite',
    patterns: [
      /\b(pr[eé]sentiel\s*(?:obligatoire|exclusif|uniquement|complet|requis)?|sur\s*site\s*(?:uniquement|exclusif)|pas\s*de\s*t[eé]l[eé]travail)\b/i,
    ],
    confidence: 0.88,
  },
  {
    policy: 'remote_friendly',
    patterns: [
      /\b(t[eé]l[eé]travail\s*possible|remote\s*friendly|open\s*[àa]\s*remote|t[eé]l[eé]travail\s*occasionnel)\b/i,
    ],
    confidence: 0.72,
  },
];

export function parseRemotePolicy(
  title: string,
  description: string,
): { policy: RemotePolicyParsed | null; daysOnsite: number | null; confidence: number } {
  const text = normalize(`${title} ${description.slice(0, 3000)}`);

  for (const { policy, patterns, extractDays, confidence } of REMOTE_PATTERNS) {
    for (const pat of patterns) {
      if (pat.test(text)) {
        let daysOnsite: number | null = null;
        if (policy === 'hybrid' && extractDays) {
          const m = text.match(extractDays);
          if (m?.[1]) {
            const remoteDays = parseInt(m[1], 10);
            // Convertit jours remote → jours sur site (semaine = 5j)
            daysOnsite = Math.max(0, 5 - remoteDays);
          }
        }
        return { policy, daysOnsite, confidence };
      }
    }
  }

  return { policy: null, daysOnsite: null, confidence: 0 };
}

// ── Extraction de stack technique ─────────────────────────────────────────────

export function extractTechStack(
  title: string,
  description: string,
  existingTags: string[],
): string[] {
  const text = normalize(`${title} ${description.slice(0, 5000)}`);
  const found = new Set<string>(existingTags.map((t) => t.toLowerCase()));

  for (const tech of allTechnos) {
    // Correspondance mot-entier (évite "go" dans "django" ou "r" dans "react")
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![a-z0-9])(${escaped})(?![a-z0-9])`, 'i');
    if (re.test(text)) found.add(tech);
  }

  return Array.from(found).sort();
}

// ── Localisation ───────────────────────────────────────────────────────────────

interface GeoResult {
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
}

const FR_CITIES: Record<string, { region: string; lat: number; lon: number }> = {
  paris: { region: 'Île-de-France', lat: 48.8566, lon: 2.3522 },
  lyon: { region: 'Auvergne-Rhône-Alpes', lat: 45.7640, lon: 4.8357 },
  marseille: { region: "Provence-Alpes-Côte d'Azur", lat: 43.2965, lon: 5.3698 },
  toulouse: { region: 'Occitanie', lat: 43.6047, lon: 1.4442 },
  bordeaux: { region: 'Nouvelle-Aquitaine', lat: 44.8378, lon: -0.5792 },
  nantes: { region: 'Pays de la Loire', lat: 47.2184, lon: -1.5536 },
  lille: { region: 'Hauts-de-France', lat: 50.6292, lon: 3.0573 },
  strasbourg: { region: 'Grand Est', lat: 48.5734, lon: 7.7521 },
  rennes: { region: 'Bretagne', lat: 48.1173, lon: -1.6778 },
  montpellier: { region: 'Occitanie', lat: 43.6109, lon: 3.8773 },
  grenoble: { region: 'Auvergne-Rhône-Alpes', lat: 45.1885, lon: 5.7245 },
  nice: { region: "Provence-Alpes-Côte d'Azur", lat: 43.7102, lon: 7.2620 },
  sophia: { region: "Provence-Alpes-Côte d'Azur", lat: 43.6167, lon: 7.0667 },
};

async function geocodeViaInsee(locationStr: string): Promise<GeoResult> {
  const normalized = normalize(locationStr);
  // Essai dans le dictionnaire local d'abord (évite un appel réseau pour les grandes villes)
  for (const [city, data] of Object.entries(FR_CITIES)) {
    if (normalized.includes(city)) {
      return { city: city.charAt(0).toUpperCase() + city.slice(1), ...data, country: 'FR' };
    }
  }

  // Appel à l'API adresse.data.gouv.fr
  try {
    const query = encodeURIComponent(locationStr.split(',')[0].trim());
    const url = `https://api-adresse.data.gouv.fr/search/?q=${query}&type=municipality&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return emptyGeo();
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return emptyGeo();
    const [lon, lat] = feature.geometry.coordinates;
    const props = feature.properties;
    const context: string = props.context || '';
    const region = context.split(',').at(-1)?.trim() ?? null;
    return { city: props.city || props.label, region, country: 'FR', lat, lon };
  } catch {
    return emptyGeo();
  }
}

function emptyGeo(): GeoResult {
  return { city: null, region: null, country: null, lat: null, lon: null };
}

// ── Clé de déduplication ───────────────────────────────────────────────────────

export function computeDedupKey(
  company: string,
  titleCanonical: string | null,
  city: string | null,
): string {
  const parts = [company, titleCanonical ?? '', city ?? '']
    .map((s) => normalize(s).replace(/[^a-z0-9]/g, ''))
    .join('|');
  return parts;
}

// ── Point d'entrée du module ───────────────────────────────────────────────────

export interface RawJobInput {
  title: string;
  company_name: string;
  description: string | null;
  location: string | null;
  tags: string[];
  remote_policy: string;
}

export async function runModule1(job: RawJobInput): Promise<NormalizationResult> {
  const description = job.description ?? '';
  const location = job.location ?? '';

  const { canonical, confidence: titleConf } = normalizeTitle(job.title);
  const { level: seniority, confidence: seniorityConf, method: seniorityMethod } =
    detectSeniority(job.title, description);

  // Remote policy : parse description d'abord, repli sur le champ existant
  const { policy, daysOnsite, confidence: remoteConf } = parseRemotePolicy(
    job.title,
    description,
  );

  // Si pas trouvé dans la description, mappe le champ existant
  let finalPolicy = policy;
  if (!finalPolicy) {
    if (job.remote_policy === 'full') finalPolicy = 'full_remote';
    else if (job.remote_policy === 'partial') finalPolicy = 'hybrid';
    else if (job.remote_policy === 'none') finalPolicy = 'onsite';
  }

  const techStack = extractTechStack(job.title, description, job.tags);
  const geo = await geocodeViaInsee(location);

  const dedupKey = computeDedupKey(job.company_name, canonical, geo.city);

  return {
    title_canonical: canonical,
    title_canonical_confidence: titleConf,
    seniority,
    seniority_confidence: seniorityConf,
    seniority_method: seniorityMethod,
    remote_policy_parsed: finalPolicy,
    remote_days_onsite: daysOnsite,
    remote_policy_confidence: policy ? remoteConf : 0.40,
    location_city: geo.city,
    location_region: geo.region,
    location_country: geo.country,
    location_lat: geo.lat,
    location_lon: geo.lon,
    tech_stack: techStack,
    dedup_key: dedupKey,
  };
}
