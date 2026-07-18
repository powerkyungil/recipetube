import { createClient } from "@supabase/supabase-js";

const supabaseBrowserClient = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  const globalKey = "__recipetube_supabase_browser__";
  const g = globalThis as typeof globalThis & {
    [key: string]: ReturnType<typeof createClient> | undefined;
  };

  if (!g[globalKey]) {
    g[globalKey] = createClient(supabaseUrl, anonKey);
  }

  return g[globalKey] ?? null;
})();

export function getSupabaseBrowser() {
  return supabaseBrowserClient;
}
