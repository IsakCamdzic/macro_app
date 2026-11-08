import { createBrowserClient } from "@supabase/ssr";

function getSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
  return raw.startsWith("http") ? raw : `https://${raw}.supabase.co`;
}

export function createClient() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "dummy-key";

  return createBrowserClient(getSupabaseUrl(), key);
}
