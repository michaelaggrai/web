import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";

export const metadata = {
  title: "The Aggr-Score — how we rate answers — aggrai",
  description:
    "Every answer aggrai compares is scored 0–10 by an independent AI judge across five weighted dimensions. Here is exactly how the Aggr-Score is calculated — and where to stay skeptical.",
};

// Dimension weights mirror lib scoring (overallScore): Accuracy 30 / Completeness 25
// / Calibration 20 / Clarity 15 / Insight 10. Keep in sync if the rubric changes.
const DIMENSIONS = [
  { name: "Accuracy", weight: "30%", desc: "Are the claims factually correct, with no fabrication or hallucination? The single most consequential dimension — and the only one with a hard safety cap (below)." },
  { name: "Completeness", weight: "25%", desc: "Does it actually answer the question asked, and the intent behind it, rather than a narrower or adjacent version?" },
  { name: "Calibration", weight: "20%", desc: "Does the answer's confidence match its evidence? Hedging where it should, committing where it can — epistemic honesty, not false certainty." },
  { name: "Clarity", weight: "15%", desc: "Is it well-structured and appropriately concise? No padding, no wall of text — the right length for the question." },
  { name: "Insight", weight: "10%", desc: "Does it add a non-obvious angle, useful framing, or a consideration the reader wouldn't have reached alone? The 'nice to have'." },
];

export default function MethodologyPage() {
  return (
    <LegalShell
      title="The Aggr-Score"
      subtitle="Every answer we compare is scored 0–10 by an independent AI judge across five weighted dimensions. Here is exactly how — and where to stay skeptical."
    >
      <article
        className="prose prose-invert prose-sm sm:prose-base max-w-none
        prose-headings:text-white prose-headings:font-semibold
        prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3
        prose-p:text-white/70 prose-li:text-white/70
        prose-strong:text-white prose-a:text-teal-300 prose-a:no-underline hover:prose-a:underline"
      >
        <p>
          When you ask aggrai a question, several models answer it independently. The <strong>Aggr-Score</strong> is a
          single 0–10 quality rating we attach to each answer, so you can see which one held up without reading every
          word of all of them. It is a <strong>judgement</strong>, not a measurement — designed to be transparent, so
          you can decide how much to trust it.
        </p>

        <h2>An independent judge</h2>
        <p>
          The models that answer your question do <strong>not</strong> score themselves. A separate model —{" "}
          <strong>Claude Haiku</strong> — reads every answer and rates each one against the same fixed rubric. It judges
          on the <em>content of the answer</em>, and applies identical criteria to every model in the comparison. That
          independence is the point: a fair comparison needs a judge with no stake in the result.
        </p>

        <h2>Five dimensions</h2>
        <p>
          Each answer is scored on five dimensions. Every dimension is itself the mean of three finer sub-criteria, then
          combined with the weights below. The weights reflect what we think matters most in a trustworthy answer —
          being <em>right</em> outranks being <em>polished</em>.
        </p>
        <div className="not-prose my-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/55">
                <th className="py-2 pr-4 font-semibold">Dimension</th>
                <th className="py-2 pr-4 font-semibold tabular-nums">Weight</th>
                <th className="py-2 font-semibold">What it measures</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSIONS.map((d) => (
                <tr key={d.name} className="border-b border-white/5 align-top">
                  <td className="py-3 pr-4 font-semibold text-white whitespace-nowrap">{d.name}</td>
                  <td className="py-3 pr-4 tabular-nums text-teal-300">{d.weight}</td>
                  <td className="py-3 text-white/70">{d.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>How the number is calculated</h2>
        <p>
          Each dimension is scored 0–5. We take the weighted average of the five (Accuracy 30%, Completeness 25%,
          Calibration 20%, Clarity 15%, Insight 10%), which gives a 0–5 result, then double it to the familiar{" "}
          <strong>0–10</strong> scale you see on the card. So a genuinely strong answer across the board lands in the
          high 8s and 9s; a mixed one sits mid-scale.
        </p>

        <h2>The fatal-flaw cap</h2>
        <p>
          One rule overrides the arithmetic. If an answer's <strong>Accuracy</strong> is critically low — confidently
          wrong, or fabricating facts — its overall score is <strong>capped at 4.0 / 10</strong>, no matter how complete,
          clear, or insightful it is. A beautifully written wrong answer is not a good answer, and we won't let strong
          presentation launder a factual failure into a high score. When the cap is applied, the card is marked{" "}
          <strong>Limited</strong> so you know why the number is low.
        </p>

        <h2>The contribution bar is a different thing</h2>
        <p>
          Don't confuse the Aggr-Score with the <em>"Where the summary came from"</em> bar. The score rates each model's{" "}
          <em>own</em> answer. The contribution bar shows how much of each model's content ended up shaping{" "}
          <strong>aggrai's combined answer</strong> — the synthesis at the top. A model can score well and still
          contribute little to the synthesis if another said the same thing better, and vice-versa.
        </p>

        <h2>What the score is — and isn't</h2>
        <ul>
          <li><strong>It's one judge's read, not ground truth.</strong> A capable model applying a consistent rubric is a strong signal, but it is still a judgement and can be wrong — especially on specialist or contested topics.</li>
          <li><strong>It's relative within a comparison.</strong> Scores are most useful for comparing the answers in front of you, not as an absolute grade of a model in general.</li>
          <li><strong>A truncated answer scores what was returned.</strong> If a provider cut an answer off at our length cap, its score reflects the partial text — that's marked <strong>Truncated</strong>, not a verdict on the model.</li>
          <li><strong>The judge can't see the future.</strong> On time-sensitive questions, an answer can be well-scored and still out of date. When we ground a question with live web search, the sources are shown so you can check.</li>
        </ul>
        <p>
          We show the full per-dimension breakdown on every answer precisely so you can disagree with the headline
          number. The score is a fast way in — the answers, and your own judgement, are the point.
        </p>

        <p className="text-sm text-white/50">
          Curious which models we compare? See the{" "}
          <Link href="/models">model list</Link>, or read more in the <Link href="/docs">docs</Link>.
        </p>
      </article>
    </LegalShell>
  );
}
