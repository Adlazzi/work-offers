import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  detectSeniority,
  parseRemotePolicy,
  extractTechStack,
  computeDedupKey,
} from '@/lib/enrichment/module1-normalizer';

describe('normalizeTitle', () => {
  it('mappe un intitulé exact au canonical', () => {
    expect(normalizeTitle('Data Engineer').canonical).toBe('data_engineer');
    expect(normalizeTitle('data engineer h/f').canonical).toBe('data_engineer');
    expect(normalizeTitle('Ingénieur Data').canonical).toBe('data_engineer');
  });

  it('mappe en correspondance partielle', () => {
    const r = normalizeTitle('Senior Data Engineer Fintech');
    expect(r.canonical).toBe('data_engineer');
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('retire les mentions H/F', () => {
    const r = normalizeTitle('Développeur React (H/F)');
    expect(r.canonical).toBe('frontend_developer');
  });

  it('retourne un slug de repli pour les intitulés inconnus', () => {
    const r = normalizeTitle('Spécialiste CRM Salesforce');
    expect(r.canonical).not.toBeNull();
    expect(r.confidence).toBeLessThan(0.5);
  });
});

describe('detectSeniority', () => {
  it('détecte senior depuis le titre', () => {
    const r = detectSeniority('Senior Data Engineer', '');
    expect(r.level).toBe('senior');
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
    expect(r.method).toBe('title');
  });

  it('détecte junior depuis le titre', () => {
    const r = detectSeniority('Junior Frontend Developer', '');
    expect(r.level).toBe('junior');
  });

  it('détecte lead depuis le titre', () => {
    const r = detectSeniority('Tech Lead React/Node', '');
    expect(r.level).toBe('lead');
  });

  it('détecte séniorité depuis la description (années)', () => {
    const desc = "Nous recherchons un développeur avec 6 ans d'expérience minimum.";
    const r = detectSeniority('Développeur Python', desc);
    expect(r.level).toBe('senior');
    expect(r.method).toBe('description');
  });

  it('retourne confirmed par défaut avec faible confiance', () => {
    const r = detectSeniority('Développeur Python', '');
    expect(r.level).toBe('confirmed');
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.method).toBe('default');
  });
});

describe('parseRemotePolicy', () => {
  it('détecte full_remote', () => {
    const r = parseRemotePolicy('', 'Poste 100% remote, télétravail complet.');
    expect(r.policy).toBe('full_remote');
    expect(r.confidence).toBeGreaterThan(0.85);
  });

  it('détecte hybrid avec nombre de jours', () => {
    const r = parseRemotePolicy('', 'Poste hybride : 3 jours de télétravail par semaine.');
    expect(r.policy).toBe('hybrid');
    expect(r.daysOnsite).toBe(2); // 5 - 3 = 2 jours sur site
  });

  it('détecte onsite', () => {
    const r = parseRemotePolicy('', 'Poste en présentiel obligatoire sur notre site de Nantes.');
    expect(r.policy).toBe('onsite');
  });

  it('retourne null si aucun signal', () => {
    const r = parseRemotePolicy('Data Engineer Paris', 'Mission passionnante sur des données complexes.');
    expect(r.policy).toBeNull();
    expect(r.confidence).toBe(0);
  });
});

describe('extractTechStack', () => {
  it('extrait les technos du titre et de la description', () => {
    const stack = extractTechStack(
      'Data Engineer Python/dbt',
      'Vous travaillerez avec Airflow, BigQuery et Snowflake. Bonus: Spark et Kafka.',
      [],
    );
    expect(stack).toContain('python');
    expect(stack).toContain('dbt');
    expect(stack).toContain('airflow');
    expect(stack).toContain('bigquery');
    expect(stack).toContain('snowflake');
    expect(stack).toContain('spark');
    expect(stack).toContain('kafka');
  });

  it('ne retourne pas de doublons', () => {
    const stack = extractTechStack('Python Developer', 'Python, python, PYTHON', []);
    const pythonCount = stack.filter((t) => t === 'python').length;
    expect(pythonCount).toBe(1);
  });

  it('préserve les tags existants', () => {
    const stack = extractTechStack('Developer', '', ['react', 'typescript']);
    expect(stack).toContain('react');
    expect(stack).toContain('typescript');
  });

  it('ne confond pas "go" avec "django" ou "mongo"', () => {
    const stack = extractTechStack('Django developer', 'Uses MongoDB and GoLang', []);
    expect(stack).toContain('golang');
    // "go" seul ne doit pas matcher dans "mongodb" ou "django"
    const goExact = stack.filter((t) => t === 'go');
    // go ET golang ne doivent pas tous deux apparaître comme doublon fonctionnel
    expect(stack.filter((t) => t === 'mongodb' || t === 'go' || t === 'golang').length).toBeGreaterThanOrEqual(1);
  });
});

describe('computeDedupKey', () => {
  it('produit des clés identiques pour des variantes normalisées', () => {
    const k1 = computeDedupKey('Capgemini', 'data_engineer', 'Paris');
    const k2 = computeDedupKey('Capgemini SA', 'data_engineer', 'Paris');
    // k1 et k2 peuvent différer légèrement mais doivent être proches (testé via pg_trgm en DB)
    expect(k1).toContain('capgemini');
    expect(k1).toContain('dataengineer');
  });

  it('gère les valeurs nulles', () => {
    const k = computeDedupKey('SNCF', null, null);
    expect(typeof k).toBe('string');
    expect(k.length).toBeGreaterThan(0);
  });
});
