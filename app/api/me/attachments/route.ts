import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";

// GET /api/me/attachments?conversationId=<id> — AGG-14.
// Returns fresh signed READ URLs for the caller's uploaded images on a
// conversation, so a REVISITED image ask can show what was attached (blob
// previews die on reload). Owner-scoped: only images on the caller's own
// questions are ever returned.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = "attachments";
const READ_TTL_S = 3600; // 1h — comfortably covers a viewing session

export async function GET(req: NextRequest) {
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const conversationId = req.nextUrl.searchParams.get("conversationId")?.trim();
  if (!conversationId || !/^[A-Za-z0-9_-]{1,64}$/.test(conversationId)) {
    return NextResponse.json({ images: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const admin = createAdminClient();
  // Questions in this conversation that belong to the caller. The root ask (turn
  // 1 / null) and any follow-up ask (turn ≥ 3, AGG-14) can each carry uploads, so
  // we return each attachment's `turn` and let the client place it on the right
  // turn. Scoping by user_id is the ownership gate.
  const { data: qs } = await admin
    .from("questions").select("id, turn")
    .eq("conversation_id", conversationId).eq("user_id", user.id);
  const turnByQid = new Map((qs ?? []).map((q) => [q.id as string, (q.turn as number | null) ?? null]));
  const qids = [...turnByQid.keys()];
  if (!qids.length) return NextResponse.json({ images: [] }, { headers: { "Cache-Control": "no-store" } });

  const { data: atts } = await admin
    .from("attachments").select("id, storage_path, mime_type, question_id")
    .in("question_id", qids).eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const images: { id: string; url: string; kind: "image" | "file"; name: string; turn: number | null }[] = [];
  for (const a of atts ?? []) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(a.storage_path, READ_TTL_S);
    if (signed?.signedUrl) images.push({
      id: a.id,
      url: signed.signedUrl,
      kind: a.mime_type === "application/pdf" ? "file" : "image",
      name: a.storage_path.split("/").pop() || "",
      turn: turnByQid.get(a.question_id) ?? null,
    });
  }
  return NextResponse.json({ images }, { headers: { "Cache-Control": "no-store" } });
}
