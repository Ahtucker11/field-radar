import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing");
if (!rawAnonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing");

const url: string = rawUrl;
const anonKey: string = rawAnonKey;

export const supabaseAnon: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export function supabaseAdmin(): SupabaseClient {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
