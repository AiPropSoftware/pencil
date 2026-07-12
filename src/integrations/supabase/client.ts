import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Public project defaults (URL + publishable key are designed to be exposed in
// the client — security is enforced by RLS, not key secrecy). Env vars override
// so different environments can point elsewhere.
const DEFAULT_URL = "https://hhhpochstmzjglzyyvoj.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_IjXg9NzzGLbOyquTP-S21A_MCtBOmyP";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_ANON_KEY;

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
