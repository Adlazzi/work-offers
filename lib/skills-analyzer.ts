import type { JobOffer } from '@/types/job';

export interface RoleCategory {
  id: string;
  name: string;
  iconName: string;
  description: string;
  keywords: string[];
}

export const ROLE_CATEGORIES: RoleCategory[] = [
  {
    id: 'all',
    name: 'Tous les Métiers',
    iconName: 'Sparkles',
    description: 'Vue globale sur l’ensemble du marché Tech & Digital',
    keywords: [],
  },
  {
    id: 'frontend',
    name: 'Frontend Developer',
    iconName: 'Layout',
    description: 'Spécialistes interfaces, web moderne et performance client',
    keywords: ['frontend', 'front-end', 'front end', 'react', 'vue', 'angular', 'ui/ux', 'next.js', 'web developer'],
  },
  {
    id: 'backend',
    name: 'Backend Developer',
    iconName: 'Server',
    description: 'Architecture serveur, APIs haute performance et microservices',
    keywords: ['backend', 'back-end', 'back end', 'golang', 'go', 'node', 'python', 'java', 'ruby', 'c#', '.net', 'api', 'rust', 'c++'],
  },
  {
    id: 'fullstack',
    name: 'Fullstack Developer',
    iconName: 'Layers',
    description: 'Développeurs polyvalents de bout en bout',
    keywords: ['fullstack', 'full-stack', 'full stack'],
  },
  {
    id: 'devops',
    name: 'DevOps & Cloud / SRE',
    iconName: 'Cloud',
    description: 'Infrastructure cloud, CI/CD, conteneurs et fiabilité système',
    keywords: ['devops', 'sre', 'cloud', 'infrastructure', 'kubernetes', 'aws', 'terraform', 'sys admin', 'site reliability'],
  },
  {
    id: 'data-ai',
    name: 'Data & IA / Machine Learning',
    iconName: 'Brain',
    description: 'Data Analysts, Data Engineers, Analytics Engineers et Ingénieurs IA / ML',
    keywords: [
      'data analyst',
      'data engineer',
      'analytics engineer',
      'ia engineer',
      'ai engineer',
      'data scientist',
      'machine learning',
      'artificial intelligence',
      'business intelligence',
      'bi analyst',
      'power bi',
      'tableau',
      'dbt',
      'snowflake',
      'databricks',
      'spark',
      'airflow',
      'data',
      'ai',
      'ml',
    ],
  },
  {
    id: 'product-qa',
    name: 'Product & QA / Testing',
    iconName: 'CheckCircle',
    description: 'Gestion produit, tests automatisés et assurance qualité',
    keywords: ['product', 'qa', 'testing', 'quality assurance', 'test', 'product manager'],
  },
  {
    id: 'mobile',
    name: 'Mobile Developer',
    iconName: 'Smartphone',
    description: 'Applications mobiles iOS, Android et cross-platform',
    keywords: ['ios', 'android', 'mobile', 'react native', 'flutter', 'swift', 'kotlin'],
  },
];

// Liste des Hard Skills à détecter et quantifier
const KNOWN_HARD_SKILLS = [
  { name: 'SQL & Bases Relationnelles', keywords: ['sql', 'postgresql', 'postgres', 'mysql', 'bigquery'] },
  { name: 'Python', keywords: ['python', 'pandas', 'numpy'] },
  { name: 'Snowflake / BigQuery / Databricks', keywords: ['snowflake', 'bigquery', 'databricks', 'data warehouse', 'data lake'] },
  { name: 'dbt & Analytics Engineering', keywords: ['dbt', 'analytics engineer', 'data modeling', 'elt'] },
  { name: 'Apache Spark / Airflow / Kafka', keywords: ['spark', 'airflow', 'kafka', 'pyspark', 'etl'] },
  { name: 'Power BI / Tableau / Looker (BI)', keywords: ['power bi', 'powerbi', 'tableau', 'looker', 'metabase', 'dashboards'] },
  { name: 'Intelligence Artificielle & LLMs', keywords: ['ai/ml', 'ai', 'ia', 'machine learning', 'llm', 'nlp', 'deep learning'] },
  { name: 'TypeScript', keywords: ['typescript', 'ts'] },
  { name: 'React / Next.js', keywords: ['react', 'next.js', 'nextjs'] },
  { name: 'Node.js', keywords: ['node.js', 'node', 'nodejs', 'express'] },
  { name: 'Go (Golang)', keywords: ['golang', 'go'] },
  { name: 'AWS Cloud', keywords: ['aws', 'amazon web services'] },
  { name: 'Docker / Kubernetes', keywords: ['docker', 'kubernetes', 'k8s'] },
  { name: 'GCP / Azure Cloud', keywords: ['gcp', 'google cloud', 'azure'] },
  { name: 'CI/CD & Terraform', keywords: ['ci/cd', 'terraform', 'automation'] },
  { name: 'Machine Learning & MLOps', keywords: ['pytorch', 'tensorflow', 'scikit-learn', 'mlops', 'model deployment'] },
];

// Liste des Soft Skills et Méthodologies
const KNOWN_SOFT_SKILLS = [
  { name: 'Méthodologie Agile / Scrum', keywords: ['agile', 'scrum', 'sprint'] },
  { name: 'Communication & Esprit d’équipe', keywords: ['communication', 'team', 'collaboration', 'collaborate'] },
  { name: 'Autonomie & Résolution de Problèmes', keywords: ['autonomy', 'autonomous', 'problem-solving', 'independent', 'ownership'] },
  { name: 'Rigueur & Code Review', keywords: ['code review', 'best practices', 'clean code', 'testing', 'quality'] },
  { name: 'Architecture & Scalabilité', keywords: ['architecture', 'scalable', 'scalability', 'distributed'] },
  { name: 'Leadership & Mentorat', keywords: ['lead', 'leadership', 'mentoring', 'mentor'] },
];

export interface SkillStat {
  name: string;
  count: number;
  percentage: number;
  level: 'Incontournable' | 'Très demandé' | 'Recherché';
}

export interface RoleAnalysis {
  role: RoleCategory;
  totalJobs: number;
  percentageOfMarket: number;
  freelanceCount: number;
  cdiCount: number;
  topHardSkills: SkillStat[];
  topSoftSkills: SkillStat[];
  activeCompanies: string[];
}

/**
 * Détermine si une offre appartient à un métier donné
 */
export function jobMatchesRole(job: JobOffer, role: RoleCategory): boolean {
  if (role.id === 'all') return true;

  const textToScan = `${job.title} ${(job.tags || []).join(' ')} ${job.description?.slice(0, 500) || ''}`.toLowerCase();

  return role.keywords.some((kw) => textToScan.includes(kw.toLowerCase()));
}

/**
 * Analyse statistique complète des compétences par métier
 */
export function analyzeSkillsByRole(allJobs: JobOffer[], selectedRoleId: string): RoleAnalysis {
  const currentRole =
    ROLE_CATEGORIES.find((r) => r.id === selectedRoleId) || ROLE_CATEGORIES[0];

  const roleJobs = allJobs.filter((job) => jobMatchesRole(job, currentRole));
  const total = roleJobs.length;

  // Calcul du ratio Freelance / CDI
  let freelanceCount = 0;
  let cdiCount = 0;
  const companiesMap = new Map<string, number>();

  roleJobs.forEach((j) => {
    if (j.contract_type === 'freelance') freelanceCount++;
    else cdiCount++;

    companiesMap.set(j.company_name, (companiesMap.get(j.company_name) || 0) + 1);
  });

  // Analyse des Hard Skills
  const hardSkillsStats: SkillStat[] = KNOWN_HARD_SKILLS.map((skill) => {
    let count = 0;
    roleJobs.forEach((job) => {
      const textToScan = `${job.title} ${(job.tags || []).join(' ')} ${job.description || ''}`.toLowerCase();
      const hasSkill = skill.keywords.some((kw) => {
        if (job.tags && job.tags.map((t) => t.toLowerCase()).includes(kw)) return true;
        return textToScan.includes(kw);
      });
      if (hasSkill) count++;
    });

    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    const level =
      percentage >= 45
        ? ('Incontournable' as const)
        : percentage >= 20
        ? ('Très demandé' as const)
        : ('Recherché' as const);

    return { name: skill.name, count, percentage, level };
  })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  // Analyse des Soft Skills & Méthodologies
  const softSkillsStats: SkillStat[] = KNOWN_SOFT_SKILLS.map((skill) => {
    let count = 0;
    roleJobs.forEach((job) => {
      const textToScan = `${job.title} ${job.description || ''}`.toLowerCase();
      const hasSkill = skill.keywords.some((kw) => textToScan.includes(kw));
      if (hasSkill) count++;
    });

    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    const level =
      percentage >= 40
        ? ('Incontournable' as const)
        : percentage >= 20
        ? ('Très demandé' as const)
        : ('Recherché' as const);

    return { name: skill.name, count, percentage, level };
  })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  // Top 5 entreprises qui recrutent
  const activeCompanies = Array.from(companiesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);

  const percentageOfMarket =
    allJobs.length > 0 ? Math.round((total / allJobs.length) * 100) : 0;

  return {
    role: currentRole,
    totalJobs: total,
    percentageOfMarket,
    freelanceCount,
    cdiCount,
    topHardSkills: hardSkillsStats.slice(0, 10),
    topSoftSkills: softSkillsStats,
    activeCompanies,
  };
}
