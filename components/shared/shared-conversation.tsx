import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layers, Globe, FileText } from "lucide-react";
import { ProviderLogo, providerOf } from "@/components/brand-icons";
import { FALLBACK_MODELS } from "@/lib/models";
import type { ShareSnapshot, ShareTurn } from "@/lib/share";
import { SharedScores, SharedAnswers, SharedFinalScores } from "@/components/shared/shared-comparison-detail";

// AGG-44: read-only render of a shared conversation snapshot. Non-interactive
// (no composer, no streaming), but it renders the SAME Aggr-Score radar +
// dimensions + folded raw answers as the live app via SharedScores/SharedAnswers
// (client), so a shared link looks like the original conversation. The summary /
// sources / contributions here are server-rendered.

const LABELS: Record<string, string> = Object.fromEntries(FALLBACK_MODELS.map((m) => [m.id, m.label]));
const label = (id: string) => LABELS[id] ?? id.split("/").pop() ?? id;

// max-w-none (not max-w-prose): the summary and single-model / direct answers
// FILL their card here, matching the app (app/app/page.tsx) — otherwise a
// full-width single-LLM answer strands its text on the left with dead space
// to the right. (The multi-model raw-answer cards live in SharedAnswers and
// keep their own narrower prose.)
const PROSE =
  "prose prose-sm sm:prose-base prose-invert max-w-none " +
  "prose-h1:text-lg prose-h1:font-semibold prose-h1:text-white prose-h1:mt-4 prose-h1:mb-2 " +
  "prose-h2:text-base prose-h2:font-semibold prose-h2:text-white prose-h2:mt-4 prose-h2:mb-2 " +
  "prose-h3:text-sm prose-h3:font-semibold prose-h3:text-white prose-h3:mt-3 prose-h3:mb-2 " +
  "prose-ul:my-2 prose-li:my-1 prose-p:my-2 prose-strong:text-white";

function Md({ children }: { children: string }) {
  return (
    <div className={PROSE}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

function ModelName({ id }: { id: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-white/90 min-w-0">
      <ProviderLogo provider={providerOf(id)} className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{label(id)}</span>
    </span>
  );
}

function Sources({ sources }: { sources: { title: string; url: string }[] }) {
  const host = (u: string) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; } };
  return (
    <div className="rounded-xl border border-teal-300/20 bg-teal-300/[0.05] px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-teal-200">
        <Globe className="w-3.5 h-3.5" aria-hidden="true" /> Searched the web · {sources.length} source{sources.length === 1 ? "" : "s"}
      </div>
      <ol className="mt-2 space-y-1 text-xs">
        {sources.map((s, i) => (
          <li key={s.url + i} className="flex gap-2 min-w-0">
            <span className="shrink-0 text-white/55 tabular-nums">[{i + 1}]</span>
            <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 truncate text-white/60 hover:text-teal-200" title={s.title}>
              <span className="text-white/80">{host(s.url)}</span><span className="text-white/55"> — {s.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

// AGG-14: images / PDFs the asker attached to this turn. The bytes are private —
// each renders through /api/share/{shareId}/attachment/{id}, which mints a signed
// URL gated on this share. Images inline as thumbnails; PDFs as file cards.
function Attachments({ shareId, attachments }: { shareId: string; attachments: { id: string; kind: "image" | "file"; name: string }[] }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((a) => a.kind === "file" ? (
        <a
          key={a.id}
          href={`/api/share/${shareId}/attachment/${a.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
        >
          <FileText className="w-4 h-4 shrink-0 text-white/55" />
          <span className="truncate max-w-[12rem]">{a.name || "Document.pdf"}</span>
        </a>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={a.id}
          src={`/api/share/${shareId}/attachment/${a.id}`}
          alt={a.name || "Attached image"}
          className="h-40 w-auto max-w-full rounded-lg border border-white/10 object-contain bg-white/5"
        />
      ))}
    </div>
  );
}

function Turn({ turn, shareId }: { turn: ShareTurn; shareId: string }) {
  const attachments = ("attachments" in turn && turn.attachments) ? turn.attachments : [];
  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full bg-teal-300/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-teal-200">You</span>
        <div className="min-w-0 space-y-2">
          <p className="text-white font-medium">{turn.question}</p>
          <Attachments shareId={shareId} attachments={attachments} />
        </div>
      </div>

      {turn.kind === "compare" && (
        <div className="space-y-4">
          {/* Summary + Aggr-Score rail — mirrors the app's SummaryPanel: the radar
              sits BESIDE the summary on large screens, stacks below on narrow. The
              grid only appears when there are scores (else the summary would be
              squeezed against an empty column). */}
          <div className={turn.answers.some((a) => a.scores) ? "grid gap-4 items-start lg:grid-cols-[2fr_1fr]" : ""}>
            <div className="rounded-2xl border border-white/10 bg-surface-2 p-6 shadow-xl min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-3.5 h-3.5 text-teal-300" />
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">Summary</p>
              </div>
              {/* Final scores — replaces the old "where the summary came from" bar. */}
              <SharedFinalScores answers={turn.answers} />
              <p className="text-[11px] font-medium normal-case tracking-normal text-white/55 mb-2">
                aggrai&apos;s answer <span className="ml-1 normal-case tracking-normal text-white/55 font-medium">· combined from all models</span>
              </p>
              <Md>{turn.summary}</Md>
            </div>
            {turn.answers.some((a) => a.scores) && (
              <div className="min-w-0"><SharedScores answers={turn.answers} /></div>
            )}
          </div>
          {/* Web-search sources — below the summary (synthesis leads, sources follow). */}
          {turn.sources && turn.sources.length > 0 && <Sources sources={turn.sources} />}
          {/* Raw answers — folded, collapsible cards like the app */}
          <SharedAnswers answers={turn.answers} />
        </div>
      )}

      {turn.kind === "single" && (
        <div className="rounded-2xl border border-white/10 bg-surface-1 p-5">
          <div className="mb-2"><ModelName id={turn.model} /></div>
          <Md>{turn.answer}</Md>
        </div>
      )}

      {turn.kind === "direct" && (
        <div className="rounded-2xl border border-white/10 bg-surface-2 p-6">
          <Md>{turn.answer}</Md>
        </div>
      )}
    </div>
  );
}

export function SharedConversation({ snapshot, shareId }: { snapshot: ShareSnapshot; shareId: string }) {
  // Newest turn first, mirroring the app (which renders the follow-up thread
  // reversed, latest under its top composer). The STORED snapshot stays
  // chronological (root first) — the fork endpoint seeds turns in that order —
  // so we reverse for DISPLAY only.
  const turns = [...snapshot.turns].reverse();
  return (
    <div className="space-y-10">
      {turns.map((turn, i) => (
        <div key={i} className={i > 0 ? "border-t border-white/10 pt-10" : ""}>
          <Turn turn={turn} shareId={shareId} />
        </div>
      ))}
    </div>
  );
}
