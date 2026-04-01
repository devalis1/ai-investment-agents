import { createClient } from "@supabase/supabase-js";

import {
  assertSupabaseConfigForServer,
  env,
} from "../config/env";

export function createServiceClient() {
  assertSupabaseConfigForServer();

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

