import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase client. We construct lazily so the app still boots in environments
 * where keys aren't set yet (e.g. landing page preview, local dev without secrets).
 * Pages that need auth/db will show a clear "configure Supabase" empty state.
 */
let _client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> | null {
  if (_client) return _client;
  if (!url || !anonKey) return null;
  _client = createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _client;
}

export const isSupabaseConfigured = () => Boolean(url && anonKey);
