import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { gatherUserData } from "@/lib/gdpr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// GET /api/me/export — GDPR Article-15/20 data export. Streams the signed-in
// user's personal data back as a downloadable JSON attachment.
export async function GET(req: NextRequest) {
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let data;
  try {
    data = await gatherUserData(createAdminClient(), user.id);
  } catch (err) {
    console.error("[me/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  const payload = {
    export_generated_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    ...data,
  };
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="aggrai-data-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
