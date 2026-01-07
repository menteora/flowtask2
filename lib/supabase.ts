import { createClient, SupabaseClient } from '@supabase/supabase-js';

// We export a helper rather than a singleton because the config is dynamic
// and stored in the application state/localStorage.
export const createSupabaseClient = (url: string, key: string): SupabaseClient => {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });
};

// Placeholder for type safety in files that import 'supabase' directly
export let supabase: SupabaseClient;

export const setGlobalSupabase = (client: SupabaseClient) => {
  supabase = client;
};
