"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, CreditCard, Globe, Cookie, Download, Trash2, LogOut, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Tier = "free" | "pro" | "premium";

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
};

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>("free");
  const [loaded, setLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No auth wired — bounce back to landing.
      router.replace("/");
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.replace("/signin?next=/settings");
        return;
      }
      setEmail(user.email ?? null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", user.id)
        .single();
      if (profile?.tier === "pro" || profile?.tier === "premium") {
        setTier(profile.tier);
      }
      setLoaded(true);
    })();
    // `router` is a stable reference from next/navigation — no need to
    // include it in deps. This effect should fire exactly once on mount.
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } catch {
      /* force reload anyway */
    }
    window.location.assign("/");
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-navy via-navy to-[#252547]" />
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Link>
          <Link href="/" className="opacity-70 hover:opacity-100 transition-opacity">
            <Logo height={24} gradientId="settings-logo" />
          </Link>
        </div>

        <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-white/40 mb-8">Manage your account and preferences.</p>

        {/* Account */}
        <Section icon={User} title="Account">
          <Row label="Email" value={email ?? "—"} />
          <Row
            label="Sign out"
            value=""
            action={
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/20 transition disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            }
          />
        </Section>

        {/* Plan */}
        <Section icon={CreditCard} title="Plan">
          <Row
            label="Current plan"
            value={TIER_LABEL[tier]}
            valueAccent={tier !== "free"}
            action={
              tier === "premium" ? (
                <span className="text-xs text-white/40">Top tier</span>
              ) : (
                <Link
                  href="/upgrade"
                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-teal-500 to-teal-400 px-3 py-1.5 text-xs font-medium text-white hover:from-teal-400 hover:to-teal-400 transition"
                >
                  {tier === "free" ? "Upgrade" : "Change plan"}
                </Link>
              )
            }
          />
        </Section>

        {/* Coming soon — placeholders for v2 GDPR + i18n work */}
        <Section icon={Globe} title="Language" comingSoon>
          <p className="text-sm text-white/40">
            Choose your interface language. Auto-detected from your browser by default.
          </p>
        </Section>

        <Section icon={Cookie} title="Cookies & tracking" comingSoon>
          <p className="text-sm text-white/40">
            Control which cookies and analytics tools we can use.
          </p>
        </Section>

        <Section icon={Download} title="Export my data" comingSoon>
          <p className="text-sm text-white/40">
            Download a copy of your account data and comparison history.
          </p>
        </Section>

        <Section icon={Trash2} title="Delete account" comingSoon danger>
          <p className="text-sm text-white/40">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
        </Section>

        <p className="mt-10 text-center text-xs text-white/30">
          Need help? <a href="mailto:hello@aggrai.com" className="text-white/50 hover:text-white underline underline-offset-2">hello@aggrai.com</a>
        </p>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  comingSoon = false,
  danger = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  comingSoon?: boolean;
  danger?: boolean;
}) {
  return (
    <section
      className={`mb-4 rounded-2xl border bg-white/[0.03] p-5 ${
        danger ? "border-red-400/20" : "border-white/10"
      } ${comingSoon ? "opacity-60" : ""}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${danger ? "text-red-300/80" : "text-white/60"}`} />
        <h2 className={`text-sm font-semibold ${danger ? "text-red-200" : "text-white"}`}>
          {title}
        </h2>
        {comingSoon && (
          <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-white/40 border border-white/10 rounded-full px-2 py-0.5">
            Coming soon
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  valueAccent = false,
  action,
}: {
  label: string;
  value: string;
  valueAccent?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-white/40 mb-0.5">{label}</div>
        {value && (
          <div className={`text-sm truncate ${valueAccent ? "text-teal-300 font-medium" : "text-white/90"}`}>
            {value}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
