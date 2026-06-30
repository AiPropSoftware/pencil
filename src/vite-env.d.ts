/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_GOOGLE_MAPS_KEY?: string;
  readonly VITE_SOCRATA_APP_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
