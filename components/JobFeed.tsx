'use client';

import React, { useState, useMemo } from 'react';
import { JobCard } from './JobCard';
import { JobFilterBar } from './JobFilterBar';
import { JobDetailModal } from './JobDetailModal';
import { SkillsRadar } from './SkillsRadar';
import { Briefcase, AlertCircle, TrendingUp, Sparkles } from 'lucide-react';
import type { JobOffer, JobFilters } from '@/types/job';

interface JobFeedProps {
  initialJobs: JobOffer[];
}

export function JobFeed({ initialJobs }: JobFeedProps) {
  const [jobs, setJobs] = useState<JobOffer[]>(initialJobs);
  const [activeTab, setActiveTab] = useState<'feed' | 'skills'>('feed');
  const [selectedJob, setSelectedJob] = useState<JobOffer | null>(null);

  const [filters, setFilters] = useState<JobFilters>({
    searchQuery: '',
    contractType: 'all',
    selectedTag: null,
    selectedSource: null,
    remoteOnly: false,
  });

  // Extraction dynamique de tous les tags uniques
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((job) => {
      if (Array.isArray(job.tags)) {
        job.tags.forEach((t) => set.add(t.toLowerCase()));
      }
    });
    return Array.from(set).slice(0, 25);
  }, [jobs]);

  // Filtrage réactif des annonces
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Filtre par contrat
      if (
        filters.contractType !== 'all' &&
        job.contract_type !== filters.contractType
      ) {
        return false;
      }

      // Filtre par source
      if (
        filters.selectedSource &&
        job.source_name.toLowerCase() !== filters.selectedSource.toLowerCase()
      ) {
        return false;
      }

      // Filtre par tag
      if (
        filters.selectedTag &&
        (!job.tags || !job.tags.includes(filters.selectedTag))
      ) {
        return false;
      }

      // Filtre par texte de recherche
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        const matchTitle = job.title.toLowerCase().includes(query);
        const matchCompany = job.company_name.toLowerCase().includes(query);
        const matchLocation = job.location?.toLowerCase().includes(query);
        const matchTag = job.tags?.some((t) => t.toLowerCase().includes(query));

        if (!matchTitle && !matchCompany && !matchLocation && !matchTag) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, filters]);

  // Navigation depuis le radar des compétences vers le feed avec filtre appliqué
  const handleNavigateFromSkills = (roleKeyword?: string, skillTag?: string) => {
    setFilters((prev) => ({
      ...prev,
      searchQuery: roleKeyword || '',
      selectedTag: skillTag || null,
      contractType: 'all',
      selectedSource: null,
    }));
    setActiveTab('feed');
  };

  return (
    <div className="space-y-6">
      {/* Sélecteur d'onglets principal : Flux d'Offres vs Compétences Clés */}
      <div className="flex items-center justify-center sm:justify-start border-b border-slate-800/80 pb-3">
        <div className="inline-flex rounded-2xl bg-slate-900/90 p-1.5 border border-slate-800 shadow-lg">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'feed'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Toutes les Offres</span>
            <span className="ml-1 rounded-full bg-slate-950/50 px-2 py-0.5 text-xs text-indigo-300 font-semibold border border-indigo-500/20">
              {filteredJobs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('skills')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'skills'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span>Compétences Clés par Métier</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
              Radar
            </span>
          </button>
        </div>
      </div>

      {/* VUE 1 : RADAR DES COMPÉTENCES CLÉS */}
      {activeTab === 'skills' ? (
        <SkillsRadar
          jobs={jobs}
          onNavigateToFeedWithFilter={handleNavigateFromSkills}
        />
      ) : (
        /* VUE 2 : FLUX D'ANNONCES CLASSIQUE */
        <div className="space-y-6">
          {/* Barre de filtres et recherche */}
          <JobFilterBar
            filters={filters}
            onChange={setFilters}
            availableTags={availableTags}
            totalResults={filteredJobs.length}
          />

          {/* État vide : aucune annonce dans la base */}
          {jobs.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Briefcase className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Aucune annonce synchronisée pour le moment
              </h3>
              <p className="max-w-md mx-auto text-sm text-slate-400 mb-6">
                Lancez le script d&apos;ingestion d&apos;annonces réelles :
              </p>
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2 text-xs font-mono text-slate-300 border border-slate-700">
                <span>npm run jobs:ingest</span>
              </div>
            </div>
          ) : filteredJobs.length === 0 ? (
            /* Aucun résultat après filtrage */
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-slate-500 mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">
                Aucune offre ne correspond à ces critères
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Essayez de réinitialiser vos filtres ou de modifier votre recherche.
              </p>
              <button
                onClick={() =>
                  setFilters({
                    searchQuery: '',
                    contractType: 'all',
                    selectedTag: null,
                    selectedSource: null,
                    remoteOnly: false,
                  })
                }
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            /* Grille des annonces */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} onSelect={setSelectedJob} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Fiche Détail */}
      <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
