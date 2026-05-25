"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, MessageSquare, Bug, Sparkles, Handshake, Mic } from "lucide-react";
import { Logo } from "@/components/logo";
import { AccountMenu } from "@/components/account-menu";

type Topic = "general" | "bug" | "feature" | "partnership" | "press";

const TOPICS: { id: Topic; label: string; icon: typeof MessageSquare; description: string }[] = [
  { id: "general",     label: "General",     icon: MessageSquare, description: "Anything else — questions, feedback, just saying hi." },
  { id: "bug",         label: "Bug report",  icon: Bug,           description: "Something broken or behaving weirdly." },
  { id: "feature",     label: "Feature idea",icon: Sparkles,      description: "Something you'd like aggrai to do." },
  { id: "partnership", label: "Partnership", icon: Handshake,     description: "Working together commercially." },
  { id: "press",       label: "Press",       icon: Mic,           description: "Media inquiries." },
];

export default function ContactPage() {
  const [topic, setTopic] = useState<Topic>("general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, name, email, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to send. Please email hello@aggrai.com instead.");
      }
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // After a successful send — show a friendly confirmation rather than the form.
  if (sent) {
    return (
      <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-16 overflow-hidden">
        <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />
        <div className="relative z-10 mx-auto max-w-md text-center">
          <div className="mb-8 inline-block">
            <Logo height={32} gradientId="contact-sent-logo" />
          </div>
          <div
            role="status"
            className="rounded-2xl border border-teal-400/20 bg-teal-400/[0.06] p-10"
          >
            <h1 className="text-2xl font-semibold text-white mb-3">Message sent</h1>
            <p className="text-white/60 leading-relaxed text-sm">
              Thanks {name ? <span className="text-white">{name}</span> : "for getting in touch"}. We&apos;ve received it and will reply
              to <span className="text-white">{email}</span> shortly.
            </p>
            <div className="mt-8 flex gap-2 justify-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Home
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setName("");
                  setEmail("");
                  setMessage("");
                  setTopic("general");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-teal-400 px-4 py-2 text-sm font-medium text-white hover:from-teal-400 hover:to-teal-400 transition"
              >
                Send another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selected = TOPICS.find(t => t.id === topic)!;

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-navy via-navy to-[#252547] px-4 py-12 overflow-hidden">
      <div className="pointer-events-none absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="opacity-70 hover:opacity-100 transition-opacity">
              <Logo height={24} gradientId="contact-logo" />
            </Link>
            <AccountMenu variant="topbar" />
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-2">Get in touch</h1>
        <p className="text-white/50 leading-relaxed mb-10">
          We read everything. Pick the closest topic so we can route your message faster.
        </p>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Topic picker */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/40 mb-3">What&apos;s this about?</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TOPICS.map(t => {
                const Icon = t.icon;
                const active = t.id === topic;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTopic(t.id)}
                    aria-pressed={active}
                    className={`flex flex-col items-center justify-center rounded-xl border px-2 py-3 text-center transition min-h-[44px] ${
                      active
                        ? "border-teal-400/60 bg-teal-400/[0.08]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1.5 ${active ? "text-teal-300" : "text-white/50"}`} />
                    <span className={`text-xs ${active ? "text-white" : "text-white/70"}`}>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-white/40">{selected.description}</p>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="contact-name" className="block text-xs font-medium uppercase tracking-wider text-white/40 mb-2">
              Your name
            </label>
            <input
              id="contact-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              autoComplete="name"
              maxLength={120}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="contact-email" className="block text-xs font-medium uppercase tracking-wider text-white/40 mb-2">
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
              autoComplete="email"
              maxLength={200}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="contact-message" className="block text-xs font-medium uppercase tracking-wider text-white/40 mb-2">
              Message
            </label>
            <textarea
              id="contact-message"
              required
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                topic === "bug"
                  ? "What happened? What were you expecting? What browser / device?"
                  : topic === "feature"
                  ? "What would you like aggrai to do, and why?"
                  : "Tell us what's on your mind."
              }
              rows={6}
              minLength={10}
              maxLength={5000}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors resize-y"
            />
            <p className="mt-1.5 text-[11px] text-white/30 text-right tabular-nums">{message.length} / 5000</p>
          </div>

          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !name || !email || message.length < 10}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 px-4 py-3 text-sm font-medium text-white transition hover:from-teal-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending…" : "Send message"}
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>

          <p className="text-[11px] text-white/30 text-center">
            Prefer email? <a href="mailto:hello@aggrai.com" className="text-white/50 hover:text-white underline underline-offset-2">hello@aggrai.com</a> works too.
          </p>
        </form>
      </div>
    </div>
  );
}
