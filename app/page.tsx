import { createServerClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/Navbar';
import { JobFeed } from '@/components/JobFeed';
import { Sparkles, ShieldCheck, Clock, Laptop } from 'lucide-react';
import type { JobOffer } from '@/types/job';

// Revalidation périodique du flux (ISR: 60 secondes)
export const revalidate = 60;

async function getJobs(): Promise<JobOffer[]> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(300);

    if (error) {
      console.error('Erreur Supabase lors de la récupération des offres :', error.message);
      return [];
    }

    return (data as JobOffer[]) || [];
  } catch (err) {
    console.error('Erreur inattendue serveur :', err);
    return [];
  }
}

export default async function HomePage() {
  const jobs = await getJobs();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Section Héro Mobile-First */}
        <section className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-400 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{jobs.length} opportunités Tech & Freelance agrégées en direct</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3 leading-tight">
            Trouvez votre prochain contrat Tech{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
              avant tout le monde
            </span>
          </h1>

          <p className="max-w-2xl text-base sm:text-lg text-slate-400 leading-relaxed mb-6">
            Toutes les meilleures annonces CDI et missions Freelance issues du web réunies dans un flux unique. Postulez directement sur le site source.
          </p>

          {/* Micro-pills arguments */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-medium text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-indigo-400" />
              <span>Mises à jour quotidiennes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Zéro doublon garanti</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Laptop className="h-4 w-4 text-violet-400" />
              <span>Missions 100% Remote & Hybride</span>
            </div>
          </div>
        </section>

        {/* Section Feed d'annonces avec recherche & filtres réactifs */}
        <JobFeed initialJobs={jobs} />
      </main>

      {/* Footer minimaliste */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <p>© 2026 WorkOffers — Inspiré du modèle Jinka pour l&apos;emploi et le freelancing Tech.</p>
      </footer>
    </div>
  );
}
