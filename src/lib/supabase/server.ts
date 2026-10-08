import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

// Acts as the recruiter, so Postgres RLS decides what they can see.
export function userClient(token: string): SupabaseClient {
  return createClient(url(), publishableKey(), {
    auth: noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Bypasses RLS. Only for the Stripe webhook, which has no recruiter.
export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url(), key, { auth: noSession });
}
