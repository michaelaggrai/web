import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";

// Allowed topic values must match the client picker.
const VALID_TOPICS = ["general", "bug", "feature", "partnership", "press"] as const;
type Topic = (typeof VALID_TOPICS)[number];

// Loose RFC-5322-ish check. We rely on the form's type="email" for the strict version;
// this is just a server-side sanity gate.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Optional — if set, contact submissions also POST to Slack so the team
// sees them without polling the database.
const SLACK_WEBHOOK = process.env.CONTACT_SLACK_WEBHOOK_URL;

export async function POST(req: NextRequest) {
  // 1. Parse + validate
  const body = await req.json().catch(() => ({}));
  const topic = body?.topic as Topic | undefined;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!topic || !VALID_TOPICS.includes(topic)) {
    return NextResponse.json({ error: "Invalid topic" }, { status: 400 });
  }
  if (name.length < 1 || name.length > 120) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (message.length < 10 || message.length > 5000) {
    return NextResponse.json({ error: "Message must be 10–5000 characters" }, { status: 400 });
  }

  // 2. Resolve caller (if signed in) — useful for routing replies and for analytics.
  let userId: string | null = null;
  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    });
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // Anonymous fallthrough — not an error, just leave userId null.
  }

  // 3. Insert into contact_messages.
  const admin = createAdminClient();
  const { error: dbError } = await admin.from("contact_messages").insert({
    topic,
    name,
    email,
    message,
    user_id: userId,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    // Country-only from Cloudflare/Vercel headers; no raw IP stored.
    country:
      req.headers.get("x-vercel-ip-country") ??
      req.headers.get("cf-ipcountry") ??
      null,
  });

  if (dbError) {
    // Log + return generic error. Don't leak DB internals to the client.
    console.error("[contact] insert failed", dbError);
    return NextResponse.json({ error: "Could not save your message. Please try again or email hello@aggrai.com." }, { status: 500 });
  }

  // 4. Best-effort Slack notify. Never block the user response on this.
  if (SLACK_WEBHOOK) {
    fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `📬 New contact message (${topic}) from *${name}* <${email}>`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*New contact: ${topic}*\nFrom: *${name}* <${email}>${userId ? `\nUser: ${userId}` : " (anonymous)"}`,
            },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: "```\n" + message.slice(0, 1500) + (message.length > 1500 ? "\n... (truncated)" : "") + "\n```" },
          },
        ],
      }),
    }).catch(err => console.error("[contact] slack notify failed", err));
  }

  return NextResponse.json({ ok: true });
}
