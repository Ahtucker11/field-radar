// Provide placeholder Supabase env vars so modules that import lib/supabase.ts
// at load time don't throw. DB-backed helpers are not exercised from unit tests.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
export {};
