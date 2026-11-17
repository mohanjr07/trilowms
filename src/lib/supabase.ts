import { createClient } from "@supabase/supabase-js";

// Connection details come from the build environment, never from source code:
//   VITE_SUPABASE_URL       e.g. https://abcdxyz.supabase.co
//   VITE_SUPABASE_ANON_KEY  the project's anon / publishable key (VITE_SUPABASE_PUBLISHABLE_KEY also works)
// Set them in .env for local work and as build variables in Cloudflare.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

/** False when the variables are missing; the app then runs on browser storage only. */
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// createClient throws on an empty URL, so a harmless placeholder is used when
// unconfigured. Callers must check supabaseConfigured before using it.
// In the browser, talk to this site's own /sb proxy (see src/server.ts) because some networks
// block *.supabase.co directly. On the server, use the real address.
const effectiveUrl = typeof window !== "undefined" && supabaseUrl ? `${window.location.origin}/sb` : supabaseUrl;

export const supabase = createClient(
  effectiveUrl || "http://localhost:54321",
  supabaseAnonKey || "not-configured",
);
