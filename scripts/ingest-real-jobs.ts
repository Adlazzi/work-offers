import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// 1. CHARGEMENT DE L'ENVIRONNEMENT LOCAL (.env.local)
// -----------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERREUR : Identifiants Supabase introuvables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// -----------------------------------------------------------------------------
// 2. MODÈLE NORMALISÉ COMMUN
// -----------------------------------------------------------------------------
interface NormalizedJob {
  title: string;
  company_name: string;
  company_logo_url: string | null;
  location: string;
  contract_type: 'cdi' | 'freelance' | 'cdd' | 'stage';
  remote_policy: 'full' | 'partial' | 'none';
  salary_min: number | null;
  salary_max: number | null;
  salary_period: 'yearly' | 'monthly' | 'daily' | 'hourly';
  currency: string;
  description: string;
  tags: string[];
  source_name: string;
  source_url: string;
  fingerprint: string;
  is_active: boolean;
  published_at: string;
}

function computeFingerprint(company: string, title: string): string {
  const norm = `${company}|${title}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  return crypto.createHash('sha256').update(norm).digest('hex');
}

function cleanTags(tags: (string | undefined | null)[]): string[] {
  const set = new Set<string>();
  for (const t of tags) {
    if (t && typeof t === 'string') {
      const cleaned = t.trim().toLowerCase().replace(/^#/, '');
      if (cleaned.length >= 2 && cleaned.length <= 30) {
        set.add(cleaned);
      }
    }
  }
  return Array.from(set);
}

function inferTagsFromTitle(title: string): string[] {
  const known = [
    'data analyst',
    'data engineer',
    'analytics engineer',
    'ia engineer',
    'ai engineer',
    'data scientist',
    'machine learning',
    'sql',
    'python',
    'dbt',
    'snowflake',
    'bigquery',
    'databricks',
    'spark',
    'airflow',
    'power bi',
    'powerbi',
    'tableau',
    'business intelligence',
    'llm',
    'deep learning',
    'nlp',
    'react',
    'typescript',
    'javascript',
    'node.js',
    'golang',
    'go',
    'java',
    'devops',
    'cloud',
    'aws',
    'docker',
    'kubernetes',
    'next.js',
    'fullstack',
    'frontend',
    'backend',
    'mobile',
  ];

  const lower = title.toLowerCase();
  return known.filter((k) => lower.includes(k));
}

// -----------------------------------------------------------------------------
// 3. CONNECTEUR 1 : REMOTIVE API (Dev + Data + IA)
// -----------------------------------------------------------------------------
async function fetchFromRemotive(): Promise<NormalizedJob[]> {
  console.log('\n[1/5] 🌐 Interrogation API Remotive (Dev, Data, IA & DevOps)...');
  const categories = ['software-development', 'data', 'artificial-intelligence', 'devops'];
  const allRemotiveJobs: NormalizedJob[] = [];

  for (const cat of categories) {
    try {
      const res = await fetch(
        `https://remotive.com/api/remote-jobs?category=${cat}&limit=35`,
        {
          headers: {
            'User-Agent': 'WorkOffersBot/1.0',
            Accept: 'application/json',
          },
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const jobs = data.jobs || [];

      for (const raw of jobs) {
        const isFreelance =
          raw.job_type === 'contract' ||
          raw.job_type === 'freelance' ||
          /contract|freelance|freelancer|consultant|tjm/i.test(
            `${raw.title} ${raw.description || ''}`
          );

        let minSal: number | null = null;
        let maxSal: number | null = null;
        if (raw.salary) {
          const nums = raw.salary.replace(/,/g, '').match(/\d+(?:\.\d+)?/g)?.map(Number);
          if (nums && nums.length > 0) {
            minSal = Math.min(...nums);
            maxSal = Math.max(...nums);
          }
        }

        allRemotiveJobs.push({
          title: raw.title,
          company_name: raw.company_name,
          company_logo_url: raw.company_logo || raw.company_logo_url || null,
          location: raw.candidate_required_location || 'Worldwide Remote',
          contract_type: isFreelance ? 'freelance' : 'cdi',
          remote_policy: 'full' as const,
          salary_min: minSal,
          salary_max: maxSal,
          salary_period: /hr|hour/i.test(raw.salary || '') ? 'hourly' : 'yearly',
          currency: raw.salary?.includes('$') ? 'USD' : 'EUR',
          description: raw.description,
          tags: cleanTags([...(raw.tags || []), ...inferTagsFromTitle(raw.title)]),
          source_name: 'Remotive',
          source_url: raw.url,
          fingerprint: computeFingerprint(raw.company_name, raw.title),
          is_active: true,
          published_at: raw.publication_date || new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn(`⚠️ Échec Remotive catégorie ${cat} :`, err);
    }
  }

  console.log(`   ✔️ Remotive : ${allRemotiveJobs.length} offres extraites.`);
  return allRemotiveJobs;
}

// -----------------------------------------------------------------------------
// 4. CONNECTEUR 2 : JOBICY API (Engineering & Data)
// -----------------------------------------------------------------------------
async function fetchFromJobicy(): Promise<NormalizedJob[]> {
  console.log('\n[2/5] 🌐 Interrogation API Jobicy (Engineering & Data)...');
  const industries = ['engineering', 'data'];
  const allJobicyJobs: NormalizedJob[] = [];

  for (const ind of industries) {
    try {
      const res = await fetch(
        `https://jobicy.com/api/v2/remote-jobs?count=40&industry=${ind}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (WorkOffers Aggregator)',
            Accept: 'application/json',
          },
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const jobs = data.jobs || [];

      for (const raw of jobs) {
        const typeStr = Array.isArray(raw.jobType) ? raw.jobType.join(' ') : raw.jobType || '';
        const isFreelance = /contract|freelance/i.test(typeStr) || /contract|freelance/i.test(raw.jobTitle);

        allJobicyJobs.push({
          title: raw.jobTitle,
          company_name: raw.companyName,
          company_logo_url: raw.companyLogo || null,
          location: raw.jobGeo || 'Worldwide Remote',
          contract_type: isFreelance ? 'freelance' : 'cdi',
          remote_policy: 'full' as const,
          salary_min: raw.salaryMin || null,
          salary_max: raw.salaryMax || null,
          salary_period: raw.salaryPeriod === 'hourly' ? 'hourly' : 'yearly',
          currency: raw.salaryCurrency || 'USD',
          description: raw.jobDescription || raw.jobExcerpt || '',
          tags: cleanTags([
            ...(raw.jobCategories || []),
            ...(raw.jobIndustries || []),
            raw.jobLevel,
            ...inferTagsFromTitle(raw.jobTitle),
          ]),
          source_name: 'Jobicy',
          source_url: raw.url,
          fingerprint: computeFingerprint(raw.companyName, raw.jobTitle),
          is_active: true,
          published_at: raw.pubDate || new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn(`⚠️ Échec Jobicy industrie ${ind} :`, err);
    }
  }

  console.log(`   ✔️ Jobicy : ${allJobicyJobs.length} offres extraites.`);
  return allJobicyJobs;
}

// -----------------------------------------------------------------------------
// 5. CONNECTEUR 3 : HIMALAYAS API
// -----------------------------------------------------------------------------
async function fetchFromHimalayas(): Promise<NormalizedJob[]> {
  console.log('\n[3/5] 🌐 Interrogation API Himalayas...');
  try {
    const res = await fetch('https://himalayas.app/jobs/api?limit=50', {
      headers: {
        'User-Agent': 'WorkOffers Aggregator/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    const jobs = data.jobs || [];

    return jobs.map((raw: any) => {
      const isFreelance =
        /contract|freelance/i.test(raw.employmentType || '') ||
        /contract|freelance/i.test(raw.title || '');

      const locations = Array.isArray(raw.locationRestrictions)
        ? raw.locationRestrictions.join(', ')
        : 'Remote';

      return {
        title: raw.title,
        company_name: raw.companyName,
        company_logo_url: raw.companyLogo || null,
        location: locations,
        contract_type: isFreelance ? 'freelance' : 'cdi',
        remote_policy: 'full' as const,
        salary_min: raw.minSalary || null,
        salary_max: raw.maxSalary || null,
        salary_period: raw.salaryPeriod === 'hourly' ? 'hourly' : 'yearly',
        currency: raw.currency || 'USD',
        description: raw.description || raw.excerpt || '',
        tags: cleanTags([
          ...(raw.categories || []),
          ...(raw.seniority || []),
          ...inferTagsFromTitle(raw.title),
        ]),
        source_name: 'Himalayas',
        source_url: raw.applicationLink || raw.guid,
        fingerprint: computeFingerprint(raw.companyName, raw.title),
        is_active: true,
        published_at: raw.pubDate
          ? new Date(raw.pubDate * 1000).toISOString()
          : new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error('⚠️ Échec Himalayas :', err);
    return [];
  }
}

// -----------------------------------------------------------------------------
// 6. CONNECTEUR 4 : REMOTEOK API
// -----------------------------------------------------------------------------
async function fetchFromRemoteOK(): Promise<NormalizedJob[]> {
  console.log('\n[4/5] 🌐 Interrogation API RemoteOK...');
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const items = await res.json();
    const jobs = Array.isArray(items) ? items.filter((j: any) => j.id && j.position) : [];

    return jobs.slice(0, 45).map((raw: any) => {
      const isFreelance =
        /contract|freelance/i.test(raw.position || '') ||
        (Array.isArray(raw.tags) && raw.tags.includes('freelance'));

      return {
        title: raw.position,
        company_name: raw.company,
        company_logo_url: raw.logo || raw.company_logo || null,
        location: raw.location || 'Remote',
        contract_type: isFreelance ? 'freelance' : 'cdi',
        remote_policy: 'full' as const,
        salary_min: raw.salary_min && raw.salary_min > 0 ? raw.salary_min : null,
        salary_max: raw.salary_max && raw.salary_max > 0 ? raw.salary_max : null,
        salary_period: 'yearly' as const,
        currency: 'USD',
        description: raw.description || '',
        tags: cleanTags([...(raw.tags || []), ...inferTagsFromTitle(raw.position)]),
        source_name: 'RemoteOK',
        source_url: raw.url || raw.apply_url,
        fingerprint: computeFingerprint(raw.company, raw.position),
        is_active: true,
        published_at: raw.date || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error('⚠️ Échec RemoteOK :', err);
    return [];
  }
}

// -----------------------------------------------------------------------------
// 7. CONNECTEUR 5 : LINKEDIN GUEST SCRAPER (FRANCE - DATA, IA & TECH)
// -----------------------------------------------------------------------------
async function fetchFromLinkedInFrance(): Promise<NormalizedJob[]> {
  console.log('\n[5/5] 🌐 Scraping LinkedIn France (Recherche Invité Ciblée Data & Tech)...');

  const keywords = [
    // Métiers DATA & IA (priorité absolue demandée)
    'data analyst',
    'data engineer',
    'analytics engineer',
    'ia engineer',
    'data scientist',
    'machine learning engineer',
    'power bi',
    'freelance data',
    // Tech & Développement
    'react',
    'python',
    'devops',
    'fullstack',
    'golang',
    'freelance developpeur',
  ];

  const jobsFound: NormalizedJob[] = [];

  for (const kw of keywords) {
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
      kw
    )}&location=France&start=0`;

    try {
      console.log(`   🔎 LinkedIn France pour : "${kw}"...`);
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8',
        },
      });

      if (!res.ok) {
        console.warn(`   ⚠️ Status LinkedIn (${res.status}) pour "${kw}"`);
        continue;
      }

      const html = await res.text();
      const cardRegex = /<div class="[^"]*base-search-card[^"]*"[\s\S]*?<\/li>/g;
      const cards = html.match(cardRegex) || [];

      for (const card of cards) {
        const titleMatch = card.match(/<h3 class="base-search-card__title">([\s\S]*?)<\/h3>/);
        const companyMatch =
          card.match(/<h4 class="base-search-card__subtitle">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/) ||
          card.match(/<h4 class="base-search-card__subtitle">([\s\S]*?)<\/h4>/);
        const locationMatch = card.match(/<span class="job-search-card__location">([\s\S]*?)<\/span>/);
        const linkMatch = card.match(/<a class="base-card__full-link[^"]*" href="([^"]+)"/);
        const logoMatch = card.match(/<img[^>]*data-delayed-url="([^"]+)"/);
        const dateMatch = card.match(/<time[^>]*datetime="([^"]+)"/);

        if (!titleMatch || !companyMatch || !linkMatch) continue;

        const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
        const company = companyMatch[1].replace(/<[^>]*>/g, '').trim();
        const location = locationMatch ? locationMatch[1].replace(/<[^>]*>/g, '').trim() : 'France';
        const cleanLink = linkMatch[1].split('?')[0];
        const logo = logoMatch ? logoMatch[1] : null;

        const isFreelance =
          kw.includes('freelance') ||
          /freelance|independant|freelancer|prestataire|tjm/i.test(title);

        const isRemote =
          /remote|télétravail|tele-travail|full remote/i.test(`${title} ${location}`);

        const tags = cleanTags([
          kw,
          ...inferTagsFromTitle(title),
        ]);

        jobsFound.push({
          title,
          company_name: company,
          company_logo_url: logo,
          location,
          contract_type: isFreelance ? 'freelance' : 'cdi',
          remote_policy: isRemote ? 'full' : 'partial',
          salary_min: null,
          salary_max: null,
          salary_period: 'yearly',
          currency: 'EUR',
          description: `<p>Poste de <strong>${title}</strong> chez <strong>${company}</strong> à <strong>${location}</strong>.</p><p>Consultez l'offre officielle complète et postulez directement sur LinkedIn.</p>`,
          tags,
          source_name: 'LinkedIn',
          source_url: cleanLink,
          fingerprint: computeFingerprint(company, title),
          is_active: true,
          published_at: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
        });
      }

      await new Promise((r) => setTimeout(r, 450));
    } catch (err) {
      console.warn(`   ⚠️ Erreur scraping "${kw}" :`, err);
    }
  }

  console.log(`   ✔️ LinkedIn France : ${jobsFound.length} offres extraites.`);
  return jobsFound;
}

// -----------------------------------------------------------------------------
// 8. PIPELINE GÉNÉRAL D'AGRÉGATION & ENREGISTREMENT
// -----------------------------------------------------------------------------
async function runMultiSourceIngestion() {
  console.log('===========================================================');
  console.log('🚀 DÉMARRAGE DU PIPELINE MULTI-SOURCES AVEC FOCUS DATA & IA');
  console.log('===========================================================');

  const [remotiveJobs, jobicyJobs, himalayasJobs, remoteOkJobs, linkedInJobs] =
    await Promise.all([
      fetchFromRemotive(),
      fetchFromJobicy(),
      fetchFromHimalayas(),
      fetchFromRemoteOK(),
      fetchFromLinkedInFrance(),
    ]);

  const allJobs = [
    ...remotiveJobs,
    ...jobicyJobs,
    ...himalayasJobs,
    ...remoteOkJobs,
    ...linkedInJobs,
  ];

  console.log('\n📊 Résumé de la collecte :');
  console.log(`- Remotive (Dev, Data, IA, DevOps) : ${remotiveJobs.length} offres`);
  console.log(`- Jobicy (Engineering & Data)       : ${jobicyJobs.length} offres`);
  console.log(`- Himalayas                         : ${himalayasJobs.length} offres`);
  console.log(`- RemoteOK                          : ${remoteOkJobs.length} offres`);
  console.log(`- LinkedIn France (Data, IA & Tech) : ${linkedInJobs.length} offres`);
  console.log(`➡️  Total brut collecté : ${allJobs.length} offres.`);

  console.log('\n💾 Insertion & Déduplication dans Supabase...');

  let insertedCount = 0;
  let errorCount = 0;

  for (const job of allJobs) {
    const { error } = await supabase.from('jobs').upsert(job, {
      onConflict: 'fingerprint',
      ignoreDuplicates: true,
    });

    if (error) {
      errorCount++;
      console.error(`❌ Erreur pour ${job.title} :`, error.message);
    } else {
      insertedCount++;
    }
  }

  console.log('\n===========================================================');
  console.log('🎉 PIPELINE TERMINÉ AVEC SUCCÈS !');
  console.log(`- Annonces traitées/enregistrées : ${insertedCount}`);
  console.log(`- Erreurs : ${errorCount}`);
  console.log('===========================================================');
}

runMultiSourceIngestion();
