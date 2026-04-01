import { createClient } from '@supabase/supabase-js';
import { getRequiredPublicEnv, getRequiredPublicEnvFromMany } from '@/lib/env';

export const supabase = createClient(
  getRequiredPublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
  getRequiredPublicEnvFromMany([
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]),
);

