import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykaorzsoajfwuzibmgoo.supabase.co";
const serviceKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

/**
 * Privileged server-side Supabase client for Next.js API routes.
 * Uses service role secret key when available to execute atomic database
 * procedures (confirm_booking_transaction, cancel_booking_transaction, etc.)
 * with verified caller context.
 */
export const serverSupabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
