import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";

export const metadata = {
  title: "Help — aggrai",
  description: "Answers to common questions about using aggrai.",
};

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What does aggrai do?",
    a: "You type a question, pick the AI models you want to compare (3 on Free/Pro, up to 5 on Premium), and aggrai sends your question to all of them in parallel. You get every model's answer side-by-side, a single rewritten \"Aggrai's answer\" that synthesises the strongest content from each, contribution attribution showing which model drove which part, and a quality score out of 10 per model judged on accuracy, completeness, calibration, clarity and insight.",
  },
  {
    q: "Which models can I use?",
    a: (
      <>
        28 models across 8 providers: Anthropic (Claude Opus 4.8, Sonnet 4.6,
        Haiku 4.5…), OpenAI (GPT-5.5 Pro, GPT-4o, GPT-4o Mini,
        Codex variants…), Google (Gemini 3.1 Pro, Gemini 2.5 Pro, Gemini 2.5
        Flash…), xAI (Grok 4.20), Meta (Llama 3.3 70B, Llama 3.1 8B),
        Mistral, DeepSeek, and Qwen. Organised into Fast / Creative /
        Reasoning / Coding / Multimodal / Frontier categories. See the
        full <Link href="/models">model catalog</Link> for the current list.
        We add models as they ship.
      </>
    ),
  },
  {
    q: "Do I need to sign up?",
    a: "No. Anyone can use the Free tier (8 basic models, 3 per comparison) without an account. You only need an account to upgrade — Pro unlocks 16 advanced models (Opus 4.8, GPT-4o, Sonnet, Grok 4.20, Gemini Pro…), Premium adds 4 research models and lets you compare up to 5 at once.",
  },
  {
    q: "What's the difference between the plans?",
    a: (
      <>
        <strong>Free</strong> — 8 basic models. Haiku 4.5, GPT-4o Mini, GPT-5.4 Mini, Gemini 2.5 Flash, Gemini 3.1 Flash Lite, Mistral Small, Llama 3.1 8B, DeepSeek v3.2. Up to 3 per comparison.
        <br />
        <strong>Pro</strong> — 16 advanced models. Every flagship: Claude Opus 4.8, Sonnet 4.6, GPT-4o, GPT-5.5, Gemini Pro, Grok 4.20, Llama 3.3 70B, Codex, Devstral and more. Up to 3 per comparison.
        <br />
        <strong>Premium</strong> — 4 research models. For deep research: GPT-5.5 Pro, DeepSeek v4 Pro, Qwen3 Max Thinking, Grok 4.20 Multi-Agent. Up to 5 per comparison.
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
        questions are forwarded to the AI providers you select for processing —
        see our <Link href="/privacy">Privacy Policy</Link> for the full data
        flow including which third-party processors are involved. We don&apos;t
        use your personal questions to train our own models.
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
    a: (
      <>
        Partially. You can share the <em>question + model selection</em> by
        copying the URL — anything like
        {" "}<code className="text-teal-200 bg-white/10 rounded px-1 py-0.5 text-xs">/app?q=…&amp;models=…</code>{" "}
        auto-submits when the recipient opens it. Sharing the <em>exact
        result</em> (so the recipient sees your answers without re-running
        them) is on the roadmap.
      </>
    ),
  },
  {
    q: "How do I cancel or downgrade my plan?",
    a: (
      <>
        Head to <Link href="/settings">Settings → Plan</Link> and pick the
        plan you want — downgrades take effect immediately. (Full self-serve
        cancellation and refund handling ship alongside our proper billing
        rollout; until then,{" "}
        <Link href="/contact" className="text-teal-300 hover:underline">
          contact us
        </Link>{" "}
        if you need anything special.)
      </>
    ),
  },
  {
    q: "I found a bug / I have feedback.",
    a: (
      <>
        Tell us on the <Link href="/contact" className="text-teal-300 hover:underline">contact page</Link> — we read everything.
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
        Didn&apos;t find your answer?{" "}
        <Link
          href="/contact"
          className="text-teal-300 hover:underline underline-offset-2"
        >
          Get in touch
        </Link>
        .
      </p>
    </LegalShell>
  );
}
