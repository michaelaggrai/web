import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";

export const metadata = {
  title: "About — aggrai",
  description: "Why we built aggrai and what we believe about asking AI questions.",
};

export default function AboutPage() {
  return (
    <LegalShell
      title="About aggrai"
      subtitle="Ask once, compare many. Built for people who want a second, third, and fourth opinion before they trust an answer."
    >
      <article className="prose prose-invert prose-sm sm:prose-base max-w-none
        prose-headings:text-white prose-headings:font-semibold
        prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3
        prose-p:text-white/70 prose-li:text-white/70
        prose-strong:text-white prose-a:text-teal-300 prose-a:no-underline hover:prose-a:underline">

        <h2>Why this exists</h2>
        <p>
          Different AI models think differently. Claude is careful and tends to
          hedge. GPT-4o is confident and reaches for examples. Gemini is concise.
          Llama and Mistral lean towards directness. Ask any of them the same
          question and you&apos;ll get materially different answers.
        </p>
        <p>
          Most people only ever see one model&apos;s answer to their question. That&apos;s
          fine for &quot;what time is it in Tokyo&quot;, but for anything important —
          a career decision, a medical question, a piece of code you&apos;re going
          to ship — one perspective isn&apos;t enough.
        </p>
        <p>
          aggrai sends your question to several leading models at once, shows
          you their answers side-by-side, and synthesises a single
          rewritten &ldquo;Aggrai&apos;s answer&rdquo; from the strongest content across
          all of them. Each answer gets a 0&ndash;100 quality score so you can
          see at a glance which model handled the question best. You stop
          guessing which model to use and start comparing what they
          actually say.
        </p>

        <h2>What we believe</h2>
        <ul>
          <li><strong>Triangulation beats trust.</strong> A single AI&apos;s answer
            should be treated as one data point, not the truth.</li>
          <li><strong>Speed matters.</strong> Comparing models should take ten
            seconds, not ten tabs.</li>
          <li><strong>The model picker is the wrong default.</strong> Most users
            shouldn&apos;t have to guess. We pick sensible defaults; you can change
            them if you want.</li>
          <li><strong>Stay neutral.</strong> We&apos;re not owned by any model
            provider. We route to whoever&apos;s best for the question.</li>
        </ul>

        <h2>How it works</h2>
        <p>
          When you submit a question we fan it out in parallel to the AI
          models you&apos;ve selected. A summariser pass
          (Claude Haiku) then scores each answer on five dimensions
          &mdash; accuracy, completeness, calibration, clarity and insight
          &mdash; and rewrites a single &ldquo;Aggrai&apos;s answer&rdquo; that
          draws the strongest content from each model, weighted by those
          scores. Per-section attribution chips name the model behind each
          part of the rewrite. Common example questions are cached so they
          load instantly. See the <Link href="/docs">docs</Link> for the details.
        </p>

        <h2>Who we are</h2>
        <p>
          aggrai is a small project built in the open, currently in beta. We
          obsess over speed, neutrality, and not getting in the way. If you have
          feedback, ideas, or want to say hi, head to our <Link href="/contact">contact page</Link>.
        </p>

        <h2>Status</h2>
        <p>
          aggrai is in public beta. Things may change, break, or be removed
          without notice. See the <Link href="/status">status page</Link> for
          current availability.
        </p>
      </article>
    </LegalShell>
  );
}
