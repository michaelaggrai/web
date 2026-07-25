import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { rateLimitOk, clientIpKey } from "@/lib/rate-limit";
import {
  newShareId,
  newRevokeToken,
  minTierForModels,
  SHARE_SNAPSHOT_MAX_BYTES,
  type ShareSnapshot,
  type ShareTurn,
  type ShareAttachment,
} from "@/lib/share";

// AGG-44: create a public, read-only snapshot of a conversation. Anyone (anon or
// signed-in) may share; writes go through the service role (the table has no
// INSERT policy), so this validation has to be airtight and rate-limited.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

function validSnapshot(s: unknown): s is ShareSnapshot {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return o.v === 1 && Array.isArray(o.turns) && o.turns.length > 0 && Array.isArray(o.models);
}

async function resolveOwner(req: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
      cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} },
    });
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null; // anonymous sharer — expected
  }
}

// Owner-scoped lookup of the ONE live share for a conversation. Signed-in owners
// match on owner_id; anonymous sharers match on the (unguessable) conversation_id
// with a null owner. Newest wins — older duplicate links from before dedup stay
// as harmless frozen snapshots.
function liveShareQuery(convId: string, ownerId: string | null) {
  const q = createAdminClient()
    .from("conversation_shares")
    .select("id, revoke_token")
    .eq("conversation_id", convId)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1);
  return ownerId ? q.eq("owner_id", ownerId) : q.is("owner_id", null);
}

// AGG-14: sharing publishes the conversation's uploaded images / PDFs. The client
// tells us which attachment ids sit on which turn, but this is a PUBLIC write we
// can't trust — a forged snapshot could otherwise name someone else's attachment
// id and turn a share link into a read primitive for it. So we STRIP every
// client-supplied attachment and re-add only ids that (a) belong to this sharer
// and (b) live on a question in THIS conversation. `kind` is derived from the row
// (never the client); `name` is a cosmetic label we keep. Anonymous shares have no
// owner → every attachment is stripped (anon users can't upload anyway).
function stripAttachments(t: ShareTurn): ShareTurn {
  if ("attachments" in t && t.attachments) {
    const clone = { ...t };
    delete (clone as { attachments?: unknown }).attachments;
    return clone;
  }
  return t;
}
async function enrichAttachments(
  snapshot: ShareSnapshot,
  ownerId: string | null,
  convId: string | null,
  admin: ReturnType<typeof createAdminClient>,
): Promise<ShareSnapshot> {
  const ids = [
    ...new Set(
      snapshot.turns
        .flatMap((t) => ("attachments" in t && Array.isArray(t.attachments) ? t.attachments : []))
        .map((a) => a?.id)
        .filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)),
    ),
  ].slice(0, 32);
  if (!ids.length || !ownerId || !convId) return { ...snapshot, turns: snapshot.turns.map(stripAttachments) };

  // The only questions whose attachments may be published: ones in THIS
  // conversation owned by the sharer.
  const { data: qs } = await admin.from("questions").select("id").eq("conversation_id", convId).eq("user_id", ownerId);
  const qids = (qs ?? []).map((q) => q.id);
  if (!qids.length) return { ...snapshot, turns: snapshot.turns.map(stripAttachments) };

  const { data: atts } = await admin
    .from("attachments")
    .select("id, mime_type")
    .in("id", ids)
    .in("question_id", qids)
    .eq("user_id", ownerId);
  const kindById = new Map(
    (atts ?? []).map((a) => [a.id as string, (a.mime_type === "application/pdf" ? "file" : "image") as "file" | "image"]),
  );

  const turns = snapshot.turns.map((t): ShareTurn => {
    if (!("attachments" in t) || !Array.isArray(t.attachments)) return t;
    const keep: ShareAttachment[] = t.attachments
      .filter((a) => a && kindById.has(a.id))
      .map((a) => ({ id: a.id, kind: kindById.get(a.id)!, name: typeof a.name === "string" ? a.name.slice(0, 200) : "" }));
    return keep.length ? { ...t, attachments: keep } : stripAttachments(t);
  });
  return { ...snapshot, turns };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const snapshot = body?.snapshot;
  if (!validSnapshot(snapshot)) {
    return NextResponse.json({ error: "Nothing to share yet." }, { status: 400 });
  }
  if (JSON.stringify(snapshot).length > SHARE_SNAPSHOT_MAX_BYTES) {
    return NextResponse.json({ error: "This conversation is too large to share." }, { status: 413 });
  }

  const ownerId = await resolveOwner(req);
  const admin = createAdminClient();
  const convId = typeof body?.conversationId === "string" ? body.conversationId.slice(0, 64) : null;
  const models: string[] = (snapshot.models as string[]).filter((m) => typeof m === "string").slice(0, 8);
  const title = String(snapshot.turns[0]?.question || "aggrai comparison").slice(0, 200);
  const origin = APP_URL || new URL(req.url).origin;
  // AGG-14: validate + rewrite the turn attachments server-side before anything is
  // stored, so the frozen snapshot only ever references the sharer's own uploads.
  const storedSnapshot = await enrichAttachments(snapshot, ownerId, convId, admin);

  // "Always latest": one share per conversation. If this conversation already has
  // a live share (owner-scoped), UPDATE its snapshot in place and return the SAME
  // link — so re-sharing, and the app's silent per-turn refresh, never mint a new
  // URL or leave an older link stale. Updates skip the rate limit: no new public
  // row is created, so they're not the spam vector the limit guards against.
  if (convId) {
    const { data: existing } = await liveShareQuery(convId, ownerId).maybeSingle();
    if (existing) {
      const { error } = await admin
        .from("conversation_shares")
        .update({ snapshot: storedSnapshot, title, models, min_tier: minTierForModels(models) })
        .eq("id", existing.id);
      if (error) {
        console.error("[share] update failed", error.message);
        return NextResponse.json({ error: "Could not update the share link." }, { status: 500 });
      }
      return NextResponse.json({ id: existing.id, url: `${origin}/share/${existing.id}`, revokeToken: existing.revoke_token });
    }
  }

  // New share — throttle creation of fresh public rows per IP.
  if (!(await rateLimitOk(`share:${clientIpKey(req)}`, 20, 3600))) {
    return NextResponse.json({ error: "Too many share links. Please try again later." }, { status: 429 });
  }

  const id = newShareId();
  const revokeToken = newRevokeToken();
  const { error } = await admin.from("conversation_shares").insert({
    id,
    conversation_id: convId,
    owner_id: ownerId,
    revoke_token: revokeToken,
    snapshot: storedSnapshot,
    title,
    models,
    min_tier: minTierForModels(models),
  });
  if (error) {
    console.error("[share] insert failed", error.message);
    return NextResponse.json({ error: "Could not create the share link." }, { status: 500 });
  }
  return NextResponse.json({ id, url: `${origin}/share/${id}`, revokeToken });
}

// Does this conversation already have a live share? (owner-scoped). Lets the app
// show the shared state when a conversation loads and keep the one link current.
export async function GET(req: NextRequest) {
  const convId = req.nextUrl.searchParams.get("conversationId");
  if (!convId) return NextResponse.json({ url: null });
  const ownerId = await resolveOwner(req);
  // Return the share's current turn count too, so the app can baseline its
  // "never shrink the share" guard — a still-hydrating (root-only) snapshot must
  // not overwrite a link that already has follow-ups.
  let q = createAdminClient()
    .from("conversation_shares")
    .select("id, snapshot")
    .eq("conversation_id", convId.slice(0, 64))
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1);
  q = ownerId ? q.eq("owner_id", ownerId) : q.is("owner_id", null);
  const { data } = await q.maybeSingle();
  if (!data) return NextResponse.json({ url: null });
  const turns = (data.snapshot as { turns?: unknown[] } | null)?.turns;
  const nTurns = Array.isArray(turns) ? turns.length : 0;
  const origin = APP_URL || new URL(req.url).origin;
  return NextResponse.json({ id: data.id, url: `${origin}/share/${data.id}`, nTurns });
}

// Unshare — matches on the revoke token returned at create time (covers anon
// sharers; a signed-in owner can also flip `revoked` via the RLS update policy).
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const token = typeof body?.revokeToken === "string" ? body.revokeToken : "";
  if (!id || !token) return NextResponse.json({ error: "Missing id or token" }, { status: 400 });

  const { error, count } = await createAdminClient()
    .from("conversation_shares")
    .update({ revoked: true }, { count: "exact" })
    .eq("id", id)
    .eq("revoke_token", token);
  if (error) return NextResponse.json({ error: "Could not unshare." }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
