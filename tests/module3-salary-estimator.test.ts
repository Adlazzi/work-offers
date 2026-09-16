import { describe, it, expect, vi } from 'vitest';
import { runModule3, type SalaryEstimatorInput } from '@/lib/enrichment/module3-salary-estimator';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock du client Supabase pour les tests (pas de vraie DB)
function makeMockDb(salaryRows: { salary_min: number; salary_max: number }[] = []): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            not: () => ({
              not: () => ({
                contains: () => ({
                  limit: () => Promise.resolve({ data: salaryRows, error: null }),
                }),
                limit: () => Promise.resolve({ data: salaryRows, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const BASE_INPUT: SalaryEstimatorInput = {
  title_canonical: 'data_engineer',
  seniority: 'senior',
  contract_type: 'cdi',
  salary_min: null,
  salary_max: null,
  salary_period: 'yearly',
  currency: 'EUR',
  location_region: null,
  location_city: null,
};

describe('runModule3 — estimation de salaire', () => {
  describe('valeur réelle présente', () => {
    it('retourne le salaire réel avec confiance 0.99 si EUR présent', async () => {
      const input: SalaryEstimatorInput = {
        ...BASE_INPUT,
        salary_min: 60000,
        salary_max: 75000,
        currency: 'EUR',
      };
      const result = await runModule3(input, makeMockDb());
      expect(result.salary_confidence).toBe(0.99);
      expect(result.salary_estimated_min).toBe(60000);
      expect(result.salary_estimated_max).toBe(75000);
      expect(result.salary_data_source).toBe('source_annonce');
      expect(result.salary_sample_size).toBe(-1);
    });

    it('ne traite pas le salaire USD comme réel EUR', async () => {
      const input: SalaryEstimatorInput = {
        ...BASE_INPUT,
        salary_min: 100000,
        salary_max: 130000,
        currency: 'USD',
      };
      const result = await runModule3(input, makeMockDb());
      // Doit passer au benchmark car pas en EUR
      expect(result.salary_confidence).toBeLessThan(0.99);
    });
  });

  describe('corpus DB', () => {
    it('utilise le corpus si ≥ 20 offres, confiance 0.82', async () => {
      const rows = Array.from({ length: 25 }, (_, i) => ({
        salary_min: 60000 + i * 1000,
        salary_max: 70000 + i * 1000,
      }));
      const result = await runModule3(BASE_INPUT, makeMockDb(rows));
      expect(result.salary_confidence).toBe(0.82);
      expect(result.salary_sample_size).toBe(25);
      expect(result.salary_estimated_median).toBeGreaterThan(0);
    });

    it('corpus 5-19 offres → confiance 0.62', async () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        salary_min: 58000 + i * 500,
        salary_max: 68000 + i * 500,
      }));
      const result = await runModule3(BASE_INPUT, makeMockDb(rows));
      expect(result.salary_confidence).toBe(0.62);
    });
  });

  describe('grille benchmark (repli)', () => {
    it('utilise le benchmark si corpus < 5, confiance 0.40', async () => {
      const result = await runModule3(BASE_INPUT, makeMockDb([]));
      expect(result.salary_confidence).toBe(0.40);
      expect(result.salary_sample_size).toBe(0);
      expect(result.salary_data_source).toContain('SalaireTech');
      expect(result.salary_estimated_median).toBeGreaterThan(0);
    });

    it('applique le multiplicateur géographique Paris (+10%)', async () => {
      const base = await runModule3(BASE_INPUT, makeMockDb([]));
      const paris = await runModule3(
        { ...BASE_INPUT, location_city: 'Paris', location_region: 'Île-de-France' },
        makeMockDb([]),
      );
      expect(paris.salary_estimated_median!).toBeGreaterThan(base.salary_estimated_median!);
    });

    it('retourne null si rôle inconnu de la grille', async () => {
      const result = await runModule3(
        { ...BASE_INPUT, title_canonical: 'role_inconnu_xyz' },
        makeMockDb([]),
      );
      expect(result.salary_estimated_median).toBeNull();
      expect(result.salary_confidence).toBe(0);
    });

    it('gère les freelances avec période daily', async () => {
      const result = await runModule3(
        { ...BASE_INPUT, contract_type: 'freelance', title_canonical: 'data_engineer', seniority: 'senior' },
        makeMockDb([]),
      );
      expect(result.salary_estimated_period).toBe('daily');
      expect(result.salary_estimated_median).toBeGreaterThan(0);
      expect(result.salary_estimated_median!).toBeLessThan(2000); // TJM, pas salaire annuel
    });
  });

  describe('hiérarchie de repli séniorité', () => {
    it('retombe sur "confirmed" si "staff" absent du benchmark', async () => {
      const result = await runModule3(
        { ...BASE_INPUT, title_canonical: 'data_analyst', seniority: 'staff' },
        makeMockDb([]),
      );
      // data_analyst n'a pas de niveau "staff" dans le benchmark, doit tomber sur senior ou confirmed
      expect(result.salary_estimated_median).not.toBeNull();
    });
  });
});
