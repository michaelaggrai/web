import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";

// AGG-48 / launch: single PKCE code-exchange endpoint shared by ALL sign-in
// providers (Google, GitHub, …) AND the password-recovery flow. The browser
// client (@supabase/ssr) stashes the PKCE verifier in a cookie precisely so
// this server route can complete the exchange and write the session cookies.
//
// Reachable without the beta password wall (allow-listed in proxy.ts) — the
// OAuth return from the provider is a top-level navigation and must land here
// regardless of gate state.

export const dynamic = "force-dynamic";

// Mirror the charset checks in handle_new_user() so we never write anything the
// trigger itself would have rejected.
const ANON_RE = /^[A-Za-z0-9_-]{1,64}$/;
const REF_RE = /^[A-Za-z0-9_:.-]{1,80}$/;
// Short-lived cookie the /signin OAuth click drops so this server route can
// stamp the funnel for social signups — signInWithOAuth can't seed
// raw_user_meta_data the way the email signUp() path does, so profiles.anon_id
// would otherwise be null for every Google/GitHub user. Consent-gated at the
// source (only set when getAnonId() returns non-null).
const ANON_LINK_COOKIE = "aggrai_anon_link";

function safeDecode(v: string): string {
  try { return decodeURIComponent(v); } catch { return v; }
}

function fail(origin: string, message: string) {
  return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(message)}`);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error_description") || searchParams.get("error");

  // Only ever redirect to an in-app path — never an attacker-supplied absolute
  // URL (open-redirect guard). `//host` and `/\host` both escape the origin.
  const rawNext = searchParams.get("next") || "/app";
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : "/app";
  const planParam = searchParams.get("plan");
  const plan = planParam === "pro" || planParam === "premium" ? planParam : null;

  if (providerError) return fail(origin, "Sign-in was cancelled. Please try again.");
  if (!code) return fail(origin, "Missing sign-in code. Please try again.");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.session) {
    return fail(origin, "Could not complete sign-in. Please try again.");
  }

  // --- Funnel stamping (best-effort; must never block the sign-in) ---
  // Fill profiles.anon_id / .ref from the browser's consent-gated cookies, but
  // only where they're currently null — never clobber a value the email path or
  // an earlier sign-in already set.
  try {
    const anonRaw = cookieStore.get(ANON_LINK_COOKIE)?.value ?? null;
    const refRaw = cookieStore.get("aggrai_ref")?.value ?? null;
    const anon = anonRaw && ANON_RE.test(anonRaw) ? anonRaw : null;
    const refDecoded = refRaw ? safeDecode(refRaw) : null;
    const ref = refDecoded && REF_RE.test(refDecoded) ? refDecoded : null;

    if (anon || ref) {
      const admin = createAdminClient();
      const { data: prof } = await admin
        .from("profiles").select("anon_id, ref").eq("id", data.session.user.id).maybeSingle();
      const patch: { anon_id?: string; ref?: string } = {};
      if (anon && prof && !prof.anon_id) patch.anon_id = anon;
      if (ref && prof && !prof.ref) patch.ref = ref;
      if (Object.keys(patch).length) {
        await admin.from("profiles").update(patch).eq("id", data.session.user.id);
      }
    }
  } catch {
    /* attribution is best-effort — a stamping failure must not fail sign-in */
  }
  // Clear the temp link cookie either way (it has served its purpose).
  try {
    cookieStore.set(ANON_LINK_COOKIE, "", { maxAge: 0, path: "/" });
  } catch {
    /* ignore */
  }

  // A paid plan chosen on signup → straight to checkout to pay; otherwise land
  // wherever they were headed (recovery flow passes next=/account/update-password).
  const dest = plan ? `/checkout?plan=${plan}&cycle=monthly` : next;
  return NextResponse.redirect(`${origin}${dest}`);
}
