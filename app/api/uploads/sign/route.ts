import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server-admin";

// POST /api/uploads/sign — AGG-14 image upload.
// Mints a one-shot signed upload URL for a SINGLE image and creates its pending
// `attachments` row. Pro+ only. The browser uploads straight to Storage with the
// returned token (uploadToSignedUrl); the ask later references { attachmentId }.
// No file bytes pass through this route — it only authorises + records.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const BUCKET = "attachments";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — mirrors the bucket file_size_limit
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // Pro+ gate — image upload is a paid feature. Free (and any unresolved) → 403.
  const { data: profile } = await supabase.from("profiles").select("tier").eq("id", user.id).single();
  const tier = profile?.tier;
  if (tier !== "pro" && tier !== "premium") {
    return NextResponse.json({ error: "Image upload is a Pro feature." }, { status: 403 });
  }

  let body: { mimeType?: unknown; sizeBytes?: unknown } = {};
  try { body = await req.json(); } catch { /* keep {} */ }
  const mimeType = String(body.mimeType ?? "");
  const sizeBytes = Number(body.sizeBytes ?? 0);
  const ext = EXT[mimeType];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type. Use PNG, JPEG, WebP, or GIF." }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be between 1 byte and 10 MB." }, { status: 400 });
  }

  const admin = createAdminClient();
  const path = `${user.id}/${randomUUID()}.${ext}`;

  const { data: signed, error: signErr } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signErr || !signed) {
    console.error("[uploads/sign] signed-url:", signErr?.message);
    return NextResponse.json({ error: "Could not start upload." }, { status: 500 });
  }

  const { data: row, error: rowErr } = await admin
    .from("attachments")
    .insert({ user_id: user.id, storage_path: path, mime_type: mimeType, size_bytes: sizeBytes, status: "pending" })
    .select("id")
    .single();
  if (rowErr || !row) {
    console.error("[uploads/sign] row:", rowErr?.message);
    return NextResponse.json({ error: "Could not start upload." }, { status: 500 });
  }

  return NextResponse.json(
    { attachmentId: row.id, path, token: signed.token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
