import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";

export const metadata = {
  title: "Docs — aggrai",
  description: "A quick guide to using aggrai.",
};

export default function DocsPage() {
  return (
    <LegalShell
      title="Docs"
      subtitle="Everything you need to start comparing AI models in 30 seconds."
    >
      <article className="prose prose-invert prose-sm sm:prose-base max-w-none
        prose-headings:text-white prose-headings:font-semibold
        prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3
        prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-white/70 prose-li:text-white/70
        prose-strong:text-white prose-a:text-teal-300 prose-a:no-underline hover:prose-a:underline
        prose-code:text-teal-200 prose-code:bg-white/10 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:font-normal">

        <h2>The 30-second tour</h2>
        <ol>
          <li>Open <Link href="/app">the app</Link>.</li>
          <li>Type a question.</li>
          <li>Pick the models you want to compare (we&apos;ve picked sensible defaults).</li>
          <li>Hit submit. You&apos;ll get each model&apos;s answer, a summary, and quality scores.</li>
        </ol>
        <p>That&apos;s it. The rest of this page is just background.</p>

        <h2>What you get back</h2>

        <h3>Per-model answers</h3>
        <p>
          One card per model with the full response. Each card shows runtime and
          token usage so you can see which model was fastest and which was most
          verbose.
        </p>

        <h3>Summary (compare mode)</h3>
        <p>
          When you select more than one model, we run a small summariser pass
          (Claude Haiku, kept short) to highlight where the models agree, where
          they disagree, and which one made claims the others didn&apos;t. Model
          names in the summary are highlighted so you can trace any claim back
          to the model that made it.
        </p>

        <h3>Comparison metrics</h3>
        <p>
          For each model: speed, readability (Flesch-Kincaid score), and detail
          (word count). Quick visual to spot the fastest, the clearest, and the
          most detailed answer.
        </p>

        <h3>Quality scores</h3>
        <p>
          A second pass scores each answer 0–5 on comprehension,
          thought-provokingness, nuance, and clarity. The scoring is also done
          by Haiku, so treat it as one model&apos;s opinion — useful as a tiebreaker,
          not gospel.
        </p>

        <h2>Tiers and limits</h2>
        <ul>
          <li><strong>Free</strong> — 3 basic models per comparison (Haiku 4.5, GPT-4o Mini, Gemini Flash). No account needed.</li>
          <li><strong>Pro</strong> — Full catalog (basic + flagship), still 3 per comparison.</li>
          <li><strong>Premium</strong> — Full catalog, up to 5 models per comparison.</li>
        </ul>
        <p>
          See <Link href="/pricing">Pricing</Link> for current pricing.
        </p>

        <h2>How questions are routed</h2>
        <p>
          We send your question in parallel to each selected model via
          <a href="https://openrouter.ai" target="_blank" rel="noreferrer"> OpenRouter</a>,
          which acts as a thin pass-through to the provider. We don&apos;t modify your
          question. The summariser and quality scorer use Anthropic&apos;s Claude
          Haiku because it&apos;s fast and cheap and good at structured output.
        </p>

        <h2>Caching</h2>
        <p>
          Common example questions from the landing page have their answers and
          summary pre-warmed in a shared cache, so they return instantly. Your
          own questions are sent fresh — no caching across users.
        </p>

        <h2>Sharing comparisons</h2>
        <p>
          You can share a question + model selection by copying the URL — e.g.
          <code>/app?q=Should+I+learn+Rust&amp;models=anthropic/claude-haiku-4-5,openai/gpt-4o-mini</code>.
          Loading that URL auto-submits the question. Shareable result pages
          (so the recipient sees your exact answers without re-running them) are
          on the roadmap.
        </p>

        <h2>API</h2>
        <p>
          We don&apos;t expose a public API yet. If you need one, email{" "}
          <a href="mailto:hello@aggrai.com">hello@aggrai.com</a> and tell us your use case.
        </p>

        <h2>Roadmap</h2>
        <ul>
          <li>Shareable comparison links</li>
          <li>Save / revisit past comparisons</li>
          <li>Public API</li>
          <li>Streaming per-model answers (currently we wait for all to finish before rendering)</li>
        </ul>

        <h2>Still stuck?</h2>
        <p>
          Check <Link href="/help">Help</Link> for FAQs, or email{" "}
          <a href="mailto:hello@aggrai.com">hello@aggrai.com</a>.
        </p>
      </article>
    </LegalShell>
  );
}
