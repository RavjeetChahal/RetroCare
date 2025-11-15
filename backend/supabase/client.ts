import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: process.env.ENV_FILE ?? '.env', override: true });

let cachedClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Check env.example for required keys.');
  }

  cachedClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  return cachedClient;
};

