import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Client serveur standard respectant Row Level Security (RLS).
 * À utiliser dans les React Server Components (RSC) et lectures publiques.
 */
export function createServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[Supabase Server] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquant.'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Client d'administration avec Service Role Key (outrepasse RLS).
 * Réservé exclusivement aux scripts d'ingestion serveur et tâches de maintenance.
 */
export function createAdminClient() {
  const secretKey = supabaseServiceRoleKey || supabaseAnonKey;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      '[Supabase Admin] Clé requise (SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    );
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
