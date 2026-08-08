import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";

// Access control for /admin. The allowlist lives in public.admin_users, which has
// RLS on with NO policies — so it is unreadable and unwritable by anon/authenticated
// even with a valid JWT. Only the service-role client (used here, server-side only)
// can see it.
//
// Every entry point must call this independently: Next's own docs warn that Server
// Functions are reachable by direct POST, not just through our UI, so a page-level
// check does NOT protect the actions.

export async function currentAdminEmail(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() { /* read-only during render */ } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (!email) return null;

  const { data } = await createAdminClient()
    .from("admin_users").select("email").eq("email", email).maybeSingle();
  return data ? email : null;
}

export async function listAdmins(): Promise<{ email: string; added_by: string | null; created_at: string }[]> {
  const { data } = await createAdminClient()
    .from("admin_users").select("email, added_by, created_at").order("created_at");
  return data ?? [];
}

/** Conservative: trims + lowercases, then a plain shape check. */
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 3 || e.length > 200) return null;
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(e) ? e : null;
}
