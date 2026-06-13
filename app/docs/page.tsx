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
          <li>Hit submit. Each model streams its answer in parallel; once they&apos;re in, you get a single rewritten &ldquo;Aggrai&apos;s answer,&rdquo; a per-model Aggr-Score radar, and a bar showing which models shaped the summary.</li>
        </ol>
        <p>That&apos;s it. The rest of this page is just background.</p>

        <h2>What you get back</h2>

        <h3>Per-model answers</h3>
        <p>
          One card per model with the full response. Each card header shows
          runtime and token usage so you can see which model was fastest and
          which was most verbose.
        </p>

        <h3>Aggrai&apos;s answer</h3>
        <p>
          When you select more than one model, we run a summariser pass
          (Claude Haiku) that synthesises a single rewritten answer drawn from
          the strongest content across all the models, weighted by each
          model&apos;s Aggr-Score. Above it, a single bar splits the rewrite by
          model so you can see what share each one contributed — the segments
          add up to 100%. Read just this section and you have a complete
          answer; the per-model cards are there if you want to see who said
          what. The summary comes back in the same language as your question.
        </p>

        <h3>Aggr-Score</h3>
        <p>
          A second pass scores each answer on five dimensions — accuracy,
          completeness, calibration (epistemic honesty), clarity, and insight
          — each the average of three specific rubric checks. Shown as a radar
          chart (each axis out of 10) with that model&apos;s overall Aggr-Score
          (out of 10) in the centre. Accuracy carries the most
          weight (30%); a confidently-wrong answer is capped at 4.0 regardless
          of how well-written it is. Each model&apos;s strongest dimensions are
          highlighted on its own radar, and you can click any radar (or the
          &ldquo;+&rdquo; button) to expand a plain-English breakdown of that
          answer&apos;s strengths and weaknesses. Scoring is done by Claude
          Haiku, so treat it as one model&apos;s opinion — a useful tiebreaker,
          not gospel.
        </p>

        <h3>Factual &amp; time-sensitive questions</h3>
        <p>
          Not every question needs a five-model debate. Simple factual
          questions (&ldquo;2+2&rdquo;, &ldquo;capital of France&rdquo;) get a
          single direct answer — no point burning the compute on a comparison
          everyone would agree on. And when a question depends on recent
          information the models may not have, we flag it: the models answer
          from training data with no live web access, so anything
          time-sensitive carries a &ldquo;may not reflect the latest&rdquo;
          note.
        </p>

        <h2>Tiers and limits</h2>
        <ul>
          <li><strong>Free</strong> — our fast, lightweight models (Claude Haiku 4.5, GPT-4o Mini, Gemini 2.5 Flash, Mistral Small, and more). Up to 3 per comparison. No account needed.</li>
          <li><strong>Pro</strong> — every flagship model (Claude Opus 4.8 Fast, Sonnet 4.6, GPT-4o, GPT-5.5, Gemini Pro, Grok 4.20, the Codex + Devstral coding models, and more). Up to 3 per comparison.</li>
          <li><strong>Premium</strong> — adds the deep-research models (Claude Opus 4.8, GPT-5.5 Pro, DeepSeek v4 Pro, Kimi K2 Thinking, GLM-5.1, MiniMax M2.5, Qwen3 Max Thinking, Grok 4.20 Multi-Agent, Nemotron 3 Ultra). Up to 5 per comparison.</li>
        </ul>
        <p>
          The line-up changes as new models ship — see the full{" "}
          <Link href="/models">model catalog</Link> for what&apos;s live right
          now, and <Link href="/pricing">Pricing</Link> for plan details.
        </p>

        <h2>How questions are routed</h2>
        <p>
          We send your question in parallel to each selected model. We
          don&apos;t modify your question. The summariser and quality
          scorer both use Claude Haiku because it&apos;s fast, cheap, and
          good at structured output.
        </p>

        <h2>Caching</h2>
        <p>
          Common example questions from the landing page have their answers and
          summary pre-warmed in a shared cache, so they return instantly. Your
          own questions are sent fresh — no caching across users.
        </p>

        <h2>Sharing comparisons</h2>
        <p>
          Each comparison gets its own short link (e.g.{" "}
          <code>/app/c/8kQ2xz</code>), but for now those are tied to the
          browser session that created them — opening one on another device,
          or sending it to someone else, won&apos;t reproduce the comparison
          yet. Shareable result links — a saved snapshot the recipient can
          open without re-running the models — are coming in V2.
        </p>

        <h2>API</h2>
        <p>
          We don&apos;t expose a public API yet. If you need one,{" "}
          <Link href="/contact">get in touch</Link> and tell us your use case.
        </p>

        <h2>Roadmap</h2>
        <ul>
          <li>Shareable result pages (your exact answers, no re-run needed)</li>
          <li>Save / revisit past comparisons across devices</li>
          <li>Public API</li>
          <li>Conversation mode (follow up on a comparison without losing context)</li>
        </ul>

        <h2>Still stuck?</h2>
        <p>
          Check <Link href="/help">Help</Link> for FAQs, or{" "}
          <Link href="/contact">contact us</Link>.
        </p>
      </article>
    </LegalShell>
  );
}
