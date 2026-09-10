/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_CIRCUIT_FILES_URL?: string;
  /** World ID relying-party id; must match the edge-function WORLD_ID_RP_ID. */
  readonly VITE_WORLD_ID_RP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
