import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server-admin";
import type { ShareSnapshot } from "@/lib/share";

// AGG-14: serve an image / PDF attached to a PUBLIC shared conversation.
// The bytes live in the private `attachments` bucket, so this mints a short-lived
// signed URL and 302s to it. It is deliberately public (a /share link is public),
// but tightly gated: the attachmentId MUST already appear in THIS share's frozen
// snapshot — and those ids were validated as the sharer's own at share time (see
// app/api/share/route.ts enrichAttachments). So this can only ever hand back a
// file the sharer chose to publish, never an arbitrary attachment id.

const BUCKET = "attachments";
const TTL_S = 600; // 10 min — one viewing session; re-minted per page load (no-store)

function attachmentIds(snapshot: ShareSnapshot | null): Set<string> {
  const ids = new Set<string>();
  for (const t of snapshot?.turns ?? []) {
    if ("attachments" in t && Array.isArray(t.attachments)) {
      for (const a of t.attachments) if (a?.id) ids.add(a.id);
    }
  }
  return ids;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!id || !attachmentId || !/^[0-9a-f-]{36}$/i.test(attachmentId)) return notFound();

  const admin = createAdminClient();
  const { data: share } = await admin
    .from("conversation_shares")
    .select("snapshot, revoked")
    .eq("id", id)
    .maybeSingle();
  if (!share || share.revoked) return notFound();

  // The share's snapshot is the allow-list. An id not on it is never served.
  if (!attachmentIds(share.snapshot as ShareSnapshot | null).has(attachmentId)) return notFound();

  const { data: att } = await admin.from("attachments").select("storage_path").eq("id", attachmentId).maybeSingle();
  if (!att?.storage_path) return notFound(); // deleted since sharing

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(att.storage_path, TTL_S);
  if (!signed?.signedUrl) return notFound();

  // Redirect to the freshly-minted signed URL. no-store so a cached redirect can't
  // outlive the signed URL it points at (the browser re-mints on the next view).
  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
