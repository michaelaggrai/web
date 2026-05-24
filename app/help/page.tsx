import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";

export const metadata = {
  title: "Help — aggrai",
  description: "Answers to common questions about using aggrai.",
};

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What does aggrai do?",
    a: "You type a question, pick up to 5 AI models, and aggrai sends your question to all of them in parallel. You get every model's answer side-by-side, plus a short summary highlighting where they agree and disagree, and quality scores for each.",
  },
  {
    q: "Which models can I use?",
    a: (
      <>
        Currently: Claude (Sonnet 4.6, Haiku 4.5), OpenAI (GPT-4o, GPT-4o Mini),
        Google (Gemini 2.5 Pro, Gemini 2.5 Flash), Mistral (Large, Small),
        and Meta (Llama 3.3 70B, Llama 3.1 8B). We add models as they ship.
      </>
    ),
  },
  {
    q: "Do I need to sign up?",
    a: "No. Anyone can use the Free tier (3 basic models, 3 per comparison) without an account. You only need an account if you want to upgrade to Pro or Premium for flagship models or more slots per comparison.",
  },
  {
    q: "What's the difference between the plans?",
    a: (
      <>
        <strong>Free</strong> — 3 basic models, up to 3 per comparison.
        <br />
        <strong>Pro</strong> — full catalog (basic + flagship), up to 3 per comparison.
        <br />
        <strong>Premium</strong> — full catalog, up to 5 per comparison.
        <br />
        See <Link href="/pricing">Pricing</Link> for details.
      </>
    ),
  },
  {
    q: "Are my questions private?",
    a: (
      <>
        Your account data and your question history are private to you. Your
        questions are forwarded to the AI providers you select (via OpenRouter)
        for processing — see our <Link href="/privacy">Privacy Policy</Link> for
        what they do with the data. We don&apos;t use your personal questions to
        train our own models.
      </>
    ),
  },
  {
    q: "Why did the same question return instantly the second time?",
    a: "We cache the answers to common example questions on the landing page so they load instantly for everyone. Your own questions aren't cached and are sent fresh to the selected models each time.",
  },
  {
    q: "The answers from different models disagree. Which one is right?",
    a: "Often, none of them are 'right' in an absolute sense — they're trained on different data, with different objectives, by different teams. Use disagreement as a signal: the question is harder, or more opinion-based, than a single model's confident answer would suggest. Verify anything important from primary sources.",
  },
  {
    q: "Can I share a comparison?",
    a: "Not yet. Shareable links for comparisons are on the roadmap.",
  },
  {
    q: "How do I cancel or downgrade my plan?",
    a: (
      <>
        Head to <Link href="/settings">Settings → Plan</Link> and pick the
        plan you want — downgrades take effect immediately. (Full self-serve
        cancellation and refund handling ship alongside our proper billing
        rollout; until then, email{" "}
        <a href="mailto:hello@aggrai.com" className="text-teal-300 hover:underline">
          hello@aggrai.com
        </a>{" "}
        if you need anything special.)
      </>
    ),
  },
  {
    q: "I found a bug / I have feedback.",
    a: (
      <>
        Email <a href="mailto:hello@aggrai.com" className="text-teal-300 hover:underline">hello@aggrai.com</a> — we read everything.
      </>
    ),
  },
];

export default function HelpPage() {
  return (
    <LegalShell
      title="Help"
      subtitle="Short answers to the questions people ask most often."
    >
      <div className="space-y-6">
        {FAQ.map(({ q, a }, i) => (
          <details
            key={i}
            className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:bg-white/[0.06] open:bg-white/[0.06]"
          >
            <summary className="cursor-pointer list-none flex items-start justify-between gap-3 text-sm font-medium text-white">
              <span>{q}</span>
              <span className="shrink-0 text-teal-300 text-xs transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-white/60">
              {a}
            </div>
          </details>
        ))}
      </div>

      <p className="mt-10 text-sm text-white/40">
        Didn&apos;t find your answer? Email{" "}
        <a
          href="mailto:hello@aggrai.com"
          className="text-teal-300 hover:underline underline-offset-2"
        >
          hello@aggrai.com
        </a>
        .
      </p>
    </LegalShell>
  );
}
