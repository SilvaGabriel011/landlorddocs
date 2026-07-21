import { createClient } from "@supabase/supabase-js";

// Server-only client using the service role key. It bypasses row level
// security, which is required to resolve share-link tokens for landlords
// who are not logged in. Never import this from a client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
