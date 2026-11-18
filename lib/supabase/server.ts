import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/** Create a Supabase client bound to the current Clerk principal for database RLS.
 * The server still uses a publishable key; do not substitute a service-role secret.
 */
export async function createClerkSupabaseServerClient() {
  const { getToken, userId } = await auth();
  if (!userId) throw new Error('A signed-in Clerk user is required.');

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
