import { createClient } from '@supabase/supabase-js';

/** Build a browser Supabase client that forwards the normal Clerk session token.
 * Activate Clerk under Supabase Auth → Third-Party Providers before using it.
 * Never replace getToken() with a Clerk JWT template.
 */
export function createClerkSupabaseClient(getToken: () => Promise<string | null>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    accessToken: async () => getToken(),
  });
}
