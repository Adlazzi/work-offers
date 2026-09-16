import React from 'react';
import { Building2, MapPin, Globe, Banknote, Calendar, ExternalLink } from 'lucide-react';
import type { JobOffer } from '@/types/job';

interface JobCardProps {
  job: JobOffer;
  onSelect: (job: JobOffer) => void;
}

export function JobCard({ job, onSelect }: JobCardProps) {
  // Formatage de la date de publication
  const formattedDate = React.useMemo(() => {
    try {
      const date = new Date(job.published_at);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) return "Aujourd'hui";
      if (diffDays === 1) return 'Hier';
      if (diffDays < 30) return `Il y a ${diffDays}j`;
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return '';
    }
  }, [job.published_at]);

  // Formatage du salaire / TJM
  const formattedSalary = React.useMemo(() => {
    if (!job.salary_min && !job.salary_max) return null;
    const currency = job.currency === 'USD' ? '$' : job.currency === 'EUR' ? '€' : '£';

    if (job.salary_period === 'daily') {
      return job.salary_max ? `${job.salary_max}${currency}/j` : `${job.salary_min}${currency}/j`;
    }
    if (job.salary_period === 'hourly') {
      return job.salary_max ? `${job.salary_max}${currency}/h` : `${job.salary_min}${currency}/h`;
    }

    // Annuel
    const minK = job.salary_min ? Math.round(job.salary_min / 1000) : null;
    const maxK = job.salary_max ? Math.round(job.salary_max / 1000) : null;

    if (minK && maxK) return `${minK}k - ${maxK}k ${currency}`;
    if (maxK) return `Jusqu'à ${maxK}k ${currency}`;
    if (minK) return `Dès ${minK}k ${currency}`;
    return null;
  }, [job.salary_min, job.salary_max, job.currency, job.salary_period]);

  const isFreelance = job.contract_type === 'freelance';

  return (
    <article
      onClick={() => onSelect(job)}
      className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-500/40 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer"
    >
      <div>
        {/* En-tête : Logo / Entreprise & Badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {job.company_logo_url ? (
              <img
                src={job.company_logo_url}
                alt={job.company_name}
                className="h-11 w-11 rounded-xl object-contain bg-slate-800 p-1 border border-slate-700/60"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 font-semibold text-slate-300 border border-slate-700/50 text-sm">
                {job.company_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <Building2 className="h-3.5 w-3.5" />
                <span>{job.company_name}</span>
              </div>
              <span className="text-[11px] text-slate-500">{job.source_name}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Badge Contrat */}
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                isFreelance
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}
            >
              {isFreelance ? 'Freelance' : 'CDI'}
            </span>

            {/* Badge Remote */}
            {job.remote_policy === 'full' && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                <Globe className="h-3 w-3" />
                <span>Remote</span>
              </span>
            )}
          </div>
        </div>

        {/* Titre du poste */}
        <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-2 mb-2">
          {job.title}
        </h3>

        {/* Détails : Localisation & Salaire */}
        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-400 mb-4">
          {job.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              <span>{job.location}</span>
            </div>
          )}

          {formattedSalary && (
            <div className="flex items-center gap-1 font-medium text-emerald-400">
              <Banknote className="h-3.5 w-3.5" />
              <span>{formattedSalary}</span>
            </div>
          )}
        </div>

        {/* Tags techniques */}
        {job.tags && job.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {job.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700/40"
              >
                #{tag}
              </span>
            ))}
            {job.tags.length > 4 && (
              <span className="rounded-md bg-slate-800/40 px-1.5 py-0.5 text-[11px] text-slate-500">
                +{job.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pied de carte : Date & Action */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formattedDate}</span>
        </div>
        <span className="flex items-center gap-1 text-indigo-400 font-medium group-hover:underline">
          Voir l&apos;offre <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </article>
  );
}
