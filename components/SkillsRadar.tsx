'use client';

import React, { useState, useMemo } from 'react';
import {
  ROLE_CATEGORIES,
  analyzeSkillsByRole,
  type RoleCategory,
  type SkillStat,
} from '@/lib/skills-analyzer';
import {
  Sparkles,
  TrendingUp,
  Cpu,
  HeartHandshake,
  Building2,
  ArrowRight,
  Briefcase,
  Layers,
  Server,
  Layout,
  Cloud,
  Brain,
  CheckCircle,
  Smartphone,
} from 'lucide-react';
import type { JobOffer } from '@/types/job';

interface SkillsRadarProps {
  jobs: JobOffer[];
  onNavigateToFeedWithFilter: (roleFilter?: string, skillTag?: string) => void;
}

export function SkillsRadar({ jobs, onNavigateToFeedWithFilter }: SkillsRadarProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>('all');

  const analysis = useMemo(() => {
    return analyzeSkillsByRole(jobs, selectedRoleId);
  }, [jobs, selectedRoleId]);

  const getRoleIcon = (iconName: string) => {
    switch (iconName) {
      case 'Layout':
        return <Layout className="h-4 w-4" />;
      case 'Server':
        return <Server className="h-4 w-4" />;
      case 'Layers':
        return <Layers className="h-4 w-4" />;
      case 'Cloud':
        return <Cloud className="h-4 w-4" />;
      case 'Brain':
        return <Brain className="h-4 w-4" />;
      case 'CheckCircle':
        return <CheckCircle className="h-4 w-4" />;
      case 'Smartphone':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const getLevelBadgeClass = (level: SkillStat['level']) => {
    switch (level) {
      case 'Incontournable':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Très demandé':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Recherché':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* En-tête de la section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 mb-2">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Observatoire des Recrutements Tech 2026</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Compétences Clés & Attentes des Recruteurs
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Statistiques en direct extraites en temps réel sur les{' '}
            <strong className="text-slate-200">{jobs.length} opportunités</strong> réelles en base.
            Sélectionnez votre métier pour orienter votre CV et votre préparation technique.
          </p>
        </div>

        <button
          onClick={() => onNavigateToFeedWithFilter()}
          className="inline-flex items-center gap-2 self-start sm:self-center rounded-xl bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all shadow-sm"
        >
          <span>Voir les offres correspondantes</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sélecteur de métiers (Segmented scrollable pill-bar) */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 block">
          Choisissez un domaine d&apos;expertise :
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {ROLE_CATEGORIES.map((cat) => {
            const isSelected = selectedRoleId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedRoleId(cat.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold border transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-lg shadow-indigo-500/25 scale-[1.02]'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {getRoleIcon(cat.iconName)}
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cartes métriques du métier sélectionné */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Métrique 1 : Volume */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Volume d&apos;offres</span>
            <Briefcase className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">{analysis.totalJobs} postes</div>
          <p className="text-xs text-slate-400 mt-1">
            {analysis.percentageOfMarket}% du marché tech actif
          </p>
        </div>

        {/* Métrique 2 : Répartition Contrat */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Répartition Contrats</span>
            <Layers className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-amber-400">{analysis.freelanceCount} Freelance</span>
            <span className="text-xs text-slate-500">/</span>
            <span className="text-lg font-bold text-indigo-400">{analysis.cdiCount} CDI</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden flex">
            <div
              className="bg-amber-500 h-full"
              style={{
                width: `${analysis.totalJobs > 0 ? (analysis.freelanceCount / analysis.totalJobs) * 100 : 50}%`,
              }}
            />
            <div
              className="bg-indigo-500 h-full"
              style={{
                width: `${analysis.totalJobs > 0 ? (analysis.cdiCount / analysis.totalJobs) * 100 : 50}%`,
              }}
            />
          </div>
        </div>

        {/* Métrique 3 : Hard Skill Reine */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Compétence N°1</span>
            <Cpu className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-white truncate">
            {analysis.topHardSkills[0]?.name || 'Polyvalence'}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Présente dans {analysis.topHardSkills[0]?.percentage || 0}% des annonces
          </p>
        </div>

        {/* Métrique 4 : Recruteurs phares */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Recruteurs Actifs</span>
            <Building2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {analysis.activeCompanies.slice(0, 3).map((comp) => (
              <span
                key={comp}
                className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700/60"
              >
                {comp}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Grille principale : Hard Skills vs Soft Skills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Colonne Gauche : HARD SKILLS */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Top Hard Skills Techniques</h3>
                <p className="text-xs text-slate-400">
                  Langages, frameworks et outils les plus cités
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-400">Fréquence</span>
          </div>

          <div className="space-y-4">
            {analysis.topHardSkills.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">
                Pas assez de données pour ce filtre spécifique.
              </p>
            ) : (
              analysis.topHardSkills.map((skill, idx) => (
                <div
                  key={skill.name}
                  onClick={() => onNavigateToFeedWithFilter(undefined, skill.name.toLowerCase().split(' ')[0])}
                  className="group rounded-xl p-2.5 -mx-2.5 transition-colors hover:bg-slate-800/40 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500 w-4">#{idx + 1}</span>
                      <span className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">
                        {skill.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getLevelBadgeClass(
                          skill.level
                        )}`}
                      >
                        {skill.level}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{skill.percentage}%</span>
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        ({skill.count} offres)
                      </span>
                    </div>
                  </div>

                  {/* Barre de progression */}
                  <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${skill.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Colonne Droite : SOFT SKILLS & MÉTHODOLOGIES */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Soft Skills & Pratiques Clés</h3>
                <p className="text-xs text-slate-400">
                  Qualités humaines et méthodologies décisives en entretien
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-400">Poids</span>
          </div>

          <div className="space-y-4">
            {analysis.topSoftSkills.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">
                Pas assez de données pour ce filtre spécifique.
              </p>
            ) : (
              analysis.topSoftSkills.map((skill, idx) => (
                <div key={skill.name} className="rounded-xl p-3 bg-slate-900/80 border border-slate-800/60">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{skill.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getLevelBadgeClass(
                          skill.level
                        )}`}
                      >
                        {skill.level}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-violet-400">{skill.percentage}%</span>
                  </div>

                  {/* Barre de progression Soft Skills */}
                  <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-violet-500 to-pink-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${skill.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Encart Conseil Candidat */}
          <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 to-violet-950/20 p-5 mt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 mb-2">
              <Sparkles className="h-4 w-4" />
              Conseil pour vos candidatures
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pour le métier <strong className="text-white">{analysis.role.name}</strong>, les recruteurs valorisent particulièrement{' '}
              <strong className="text-indigo-300">{analysis.topHardSkills[0]?.name || 'la maîtrise technique'}</strong> associée à{' '}
              <strong className="text-violet-300">{analysis.topSoftSkills[0]?.name || 'une forte autonomie'}</strong>.
              Mentionnez explicitement ces mots-clés dans votre CV et lors de votre premier échange.
            </p>
          </div>
        </div>
      </div>

      {/* Bannière CTA Finale : Voir les offres du métier */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">
            Prêt à postuler ? {analysis.totalJobs} opportunités vous attendent
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Retrouvez tous les postes pour {analysis.role.name} et postulez directement à la source.
          </p>
        </div>

        <button
          onClick={() =>
            onNavigateToFeedWithFilter(
              analysis.role.id === 'all' ? undefined : analysis.role.keywords[0]
            )
          }
          className="whitespace-nowrap px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition-all flex items-center gap-2"
        >
          <span>Consulter les {analysis.totalJobs} offres</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
