'use client';

import React from 'react';
import { Search, Globe, X } from 'lucide-react';
import type { JobFilters } from '@/types/job';

interface JobFilterBarProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
  availableTags: string[];
  totalResults: number;
}

export function JobFilterBar({
  filters,
  onChange,
  availableTags,
  totalResults,
}: JobFilterBarProps) {
  const popularTags = [
    'react',
    'typescript',
    'python',
    'node.js',
    'devops',
    'golang',
    'ai/ml',
    'next.js',
    'sql',
  ];

  const sources = ['LinkedIn', 'Remotive', 'Jobicy', 'Himalayas', 'RemoteOK'];

  const handleContractChange = (contractType: 'all' | 'freelance' | 'cdi') => {
    onChange({ ...filters, contractType });
  };

  const handleTagToggle = (tag: string) => {
    const newTag = filters.selectedTag === tag ? null : tag;
    onChange({ ...filters, selectedTag: newTag });
  };

  const handleSourceToggle = (source: string) => {
    const newSource = filters.selectedSource === source ? null : source;
    onChange({ ...filters, selectedSource: newSource });
  };

  return (
    <div className="space-y-4">
      {/* Barre de recherche principale */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
          <Search className="h-5 w-5" />
        </div>
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
          placeholder="Rechercher un poste, techno, entreprise (ex: React, Golang, AI, Lemon, Addepar)..."
          className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 py-3.5 pl-11 pr-10 text-sm text-white placeholder-slate-500 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
        />
        {filters.searchQuery && (
          <button
            onClick={() => onChange({ ...filters, searchQuery: '' })}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Switchers : Contrats & Sources */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Switcher Contrats */}
          <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800">
            <button
              onClick={() => handleContractChange('all')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filters.contractType === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Toutes ({totalResults})
            </button>
            <button
              onClick={() => handleContractChange('freelance')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filters.contractType === 'freelance'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚡ Freelance
            </button>
            <button
              onClick={() => handleContractChange('cdi')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filters.contractType === 'cdi'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🏢 CDI / Salariat
            </button>
          </div>

          {/* Filtres par Plateforme Source */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Sources :
            </span>
            {sources.map((src) => {
              const isSelected = filters.selectedSource === src;
              return (
                <button
                  key={src}
                  onClick={() => handleSourceToggle(src)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {src}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags technologiques rapides */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Technologies :
          </span>
          {popularTags.map((tag) => {
            const isSelected = filters.selectedTag === tag;
            return (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium border transition-all ${
                  isSelected
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
