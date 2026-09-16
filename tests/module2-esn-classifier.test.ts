import { describe, it, expect } from 'vitest';
import { runModule2 } from '@/lib/enrichment/module2-esn-classifier';

describe('runModule2 — classification ESN/Produit', () => {
  describe('table de référence', () => {
    it('identifie Capgemini comme ESN avec très haute confiance', () => {
      const r = runModule2({ company_name: 'Capgemini', description: '' });
      expect(r.company_category).toBe('esn_ssii');
      expect(r.company_category_confidence).toBeGreaterThanOrEqual(0.95);
      expect(r.company_category_method).toBe('reference_table');
    });

    it('identifie Sopra Steria comme ESN', () => {
      const r = runModule2({ company_name: 'Sopra Steria', description: '' });
      expect(r.company_category).toBe('esn_ssii');
    });

    it('identifie Devoteam comme ESN', () => {
      const r = runModule2({ company_name: 'Devoteam', description: '' });
      expect(r.company_category).toBe('esn_ssii');
    });

    it('identifie Wavestone comme cabinet de conseil', () => {
      const r = runModule2({ company_name: 'Wavestone', description: '' });
      expect(r.company_category).toBe('cabinet_conseil');
    });

    it('identifie Deloitte comme cabinet de conseil', () => {
      const r = runModule2({ company_name: 'Deloitte', description: '' });
      expect(r.company_category).toBe('cabinet_conseil');
    });

    it('est insensible à la casse et aux suffixes légaux', () => {
      const r = runModule2({ company_name: 'ALTEN SA', description: '' });
      expect(r.company_category).toBe('esn_ssii');
    });

    it('identifie Doctolib comme produit via les signaux', () => {
      const r = runModule2({ company_name: 'Doctolib', description: '' });
      expect(r.company_category).toBe('editeur_produit');
    });
  });

  describe('heuristiques sur la description', () => {
    it('détecte un signal fort ESN via "chez notre client"', () => {
      const r = runModule2({
        company_name: 'TechConsult Inconnue SARL',
        description: 'Vous interviendrez chez notre client dans le secteur bancaire en régie.',
      });
      expect(r.company_category).toBe('esn_ssii');
      expect(r.company_category_confidence).toBeGreaterThan(0.6);
      expect(r.company_category_method).toBe('heuristic');
    });

    it('détecte un signal fort produit via "notre plateforme"', () => {
      const r = runModule2({
        company_name: 'Inconnue SAS',
        description: 'Rejoignez notre équipe pour construire notre plateforme SaaS de nouvelle génération.',
      });
      expect(r.company_category).toBe('editeur_produit');
    });

    it('détecte une startup via "levée de fonds"', () => {
      const r = runModule2({
        company_name: 'NewStartupXYZ',
        description: 'Suite à notre levée de fonds Série A de 10M€, nous recrutons nos premiers ingénieurs.',
      });
      expect(['startup', 'scale_up']).toContain(r.company_category);
    });

    it('retourne "autre" avec faible confiance si aucun signal', () => {
      const r = runModule2({
        company_name: 'Entreprise Inconnue',
        description: 'Rejoignez notre équipe dynamique.',
      });
      expect(r.company_category).toBe('autre');
      expect(r.company_category_confidence).toBeLessThan(0.5);
    });
  });
});
