import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  const env = getServerEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set DATABASE_PROVIDER=supabase with Supabase credentials to use it.",
    );
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
