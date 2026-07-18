import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { SharedConversation } from "@/components/shared/shared-conversation";
import { ShareRef } from "@/components/shared/share-ref";
import { ShareContinue } from "@/components/shared/share-continue";
import { Logo } from "@/components/logo";
import type { ShareSnapshot } from "@/lib/share";

// AGG-44: public, read-only shared conversation. Reachable WITHOUT the beta
// password (allow-listed in proxy.ts). Rows are frozen snapshots; a revoked
// share 404s.

type ShareRow = { snapshot: ShareSnapshot; title: string | null; models: string[] | null; revoked: boolean };

async function getShare(id: string): Promise<ShareRow | null> {
  const { data } = await createAdminClient()
    .from("conversation_shares")
    .select("snapshot, title, models, revoked")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.revoked) return null;
  return data as ShareRow;
  // (view_count / attribution comes in Phase 2)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const share = await getShare(id);
  const title = share?.title ? `${share.title} — aggrai` : "Shared comparison — aggrai";
  const description = "A multi-model AI comparison, shared from aggrai — ask once, compare many.";
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "article", siteName: "aggrai" },
    twitter: { card: "summary", title, description },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) notFound();

  const snapshot = share.snapshot;
  const models = share.models ?? snapshot.models ?? [];

  return (
    <div className="relative min-h-dvh bg-navy">
      <ShareRef id={id} />
      <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 w-[640px] h-[480px] bg-teal-500/15 rounded-full blur-[130px]" />

      <header className="relative z-10 border-b border-white/10">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-4">
          <Logo height={26} />
          <ShareContinue
            models={models}
            snapshot={snapshot}
            label="Continue the conversation"
            className="rounded-lg bg-gradient-to-r from-teal-500 to-teal-400 px-3.5 py-1.5 text-sm font-semibold text-navy hover:from-teal-400 hover:to-teal-400 transition disabled:opacity-70"
          />
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-teal-300/25 bg-teal-300/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-200">
          Shared comparison
        </div>

        <SharedConversation snapshot={snapshot} />

        {/* Continue — hands off to the app with the same models pre-selected; the
            app's per-model tier locks apply (a viewer can only continue with the
            models their tier allows, matching how follow-ups already gate). */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-surface-1 p-6 text-center">
          <p className="text-white font-medium">Want to dig deeper with these models?</p>
          <p className="mt-1 text-sm text-white/55">Continue in aggrai — pick up this conversation and ask your own follow-up. You can continue with the models your plan includes.</p>
          <ShareContinue models={models} snapshot={snapshot} />
        </div>

        <p className="mt-8 text-center text-xs text-white/40">
          Shared via aggrai · <Link href="/app" className="text-teal-300/80 hover:text-teal-200">aggrai.com</Link>
        </p>
      </main>
    </div>
  );
}
