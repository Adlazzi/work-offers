'use client';

import React from 'react';
import {
  X,
  Building2,
  MapPin,
  Globe,
  Banknote,
  Calendar,
  ExternalLink,
  Share2,
} from 'lucide-react';
import type { JobOffer } from '@/types/job';

interface JobDetailModalProps {
  job: JobOffer | null;
  onClose: () => void;
}

export function JobDetailModal({ job, onClose }: JobDetailModalProps) {
  // Gestion de la fermeture via la touche Échap
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (job) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [job, onClose]);

  if (!job) return null;

  const isFreelance = job.contract_type === 'freelance';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Overlay click to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Box */}
      <div className="relative z-10 flex flex-col w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-4">
            {job.company_logo_url ? (
              <img
                src={job.company_logo_url}
                alt={job.company_name}
                className="h-14 w-14 rounded-2xl object-contain bg-slate-800 p-1.5 border border-slate-700"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-bold text-lg shadow-md shadow-indigo-500/20">
                {job.company_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                <Building2 className="h-4 w-4" />
                <span>{job.company_name}</span>
              </div>
              <h2 className="text-xl font-bold text-white mt-0.5">{job.title}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps défilant */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Métadonnées & Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                isFreelance
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}
            >
              {isFreelance ? 'Mission Freelance' : 'Contrat CDI'}
            </span>

            {job.remote_policy === 'full' && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <Globe className="h-3.5 w-3.5" />
                <span>100% Télétravail</span>
              </span>
            )}

            {job.location && (
              <span className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 border border-slate-700">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>{job.location}</span>
              </span>
            )}

            <span className="flex items-center gap-1.5 rounded-full bg-slate-800/60 px-3 py-1 text-xs text-slate-400 border border-slate-800">
              <Calendar className="h-3.5 w-3.5" />
              <span>Publié le {new Date(job.published_at).toLocaleDateString('fr-FR')}</span>
            </span>
          </div>

          {/* Tags */}
          {job.tags && job.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Compétences & Stack
              </h4>
              <div className="flex flex-wrap gap-2">
                {job.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-indigo-300 border border-slate-700/60"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Description du poste
            </h4>
            <div
              className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed space-y-4"
              dangerouslySetInnerHTML={{
                __html: job.description || 'Aucune description détaillée fournie.',
              }}
            />
          </div>
        </div>

        {/* Footer sticky avec bouton CTA Postuler */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 hidden sm:block">
            Source officielle : <span className="text-slate-200 font-semibold">{job.source_name}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Fermer
            </button>
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition-all"
            >
              <span>Postuler sur le site d&apos;origine</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
