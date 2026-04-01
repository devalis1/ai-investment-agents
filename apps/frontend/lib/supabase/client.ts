import { createClient } from '@supabase/supabase-js';

function requirePublicEnv(value: string | undefined, name: string): string {
  if (value) return value;
  throw new Error(
    `Missing required environment variable: ${name}. Add it to apps/frontend/.env.local.`,
  );
}

const supabaseUrl = requirePublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  'NEXT_PUBLIC_SUPABASE_URL',
);

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl,
  requirePublicEnv(
    supabaseKey,
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)',
  ),
);

