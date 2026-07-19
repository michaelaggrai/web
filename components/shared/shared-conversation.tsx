import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layers, Globe } from "lucide-react";
import { ProviderLogo, providerOf } from "@/components/brand-icons";
import { FALLBACK_MODELS } from "@/lib/models";
import type { ShareSnapshot, ShareTurn } from "@/lib/share";
import { SharedScores, SharedAnswers } from "@/components/shared/shared-comparison-detail";

// AGG-44: read-only render of a shared conversation snapshot. Non-interactive
// (no composer, no streaming), but it renders the SAME Aggr-Score radar +
// dimensions + folded raw answers as the live app via SharedScores/SharedAnswers
// (client), so a shared link looks like the original conversation. The summary /
// sources / contributions here are server-rendered.

const LABELS: Record<string, string> = Object.fromEntries(FALLBACK_MODELS.map((m) => [m.id, m.label]));
const label = (id: string) => LABELS[id] ?? id.split("/").pop() ?? id;

const PROSE =
  "prose prose-sm sm:prose-base prose-invert max-w-[68ch] " +
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

function ContributionsBar({ contributions }: { contributions: { model: string; pct: number }[] }) {
  const palette = ["from-teal-400 to-teal-300", "from-blue-400 to-blue-300", "from-purple-400 to-purple-300", "from-amber-400 to-amber-300", "from-rose-400 to-rose-300"];
  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-1.5">Where the summary came from</p>
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {contributions.map((c, i) => (
          <div key={c.model} className={`h-full bg-gradient-to-r ${palette[i % palette.length]}`} style={{ width: `${c.pct}%` }} title={`${label(c.model)} · ${c.pct}%`} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {contributions.map((c) => (
          <span key={c.model} className="inline-flex items-center gap-1 text-[11px] text-white/60">
            <ProviderLogo provider={providerOf(c.model)} className="w-2.5 h-2.5" /> {label(c.model)} <span className="tabular-nums text-white/45">{c.pct}%</span>
          </span>
        ))}
      </div>
    </div>
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

function Turn({ turn }: { turn: ShareTurn }) {
  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5 inline-flex items-center rounded-full bg-teal-300/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-teal-200">You</span>
        <p className="text-white font-medium">{turn.question}</p>
      </div>

      {turn.kind === "compare" && (
        <div className="space-y-4">
          {turn.sources && turn.sources.length > 0 && <Sources sources={turn.sources} />}
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
              {turn.contributions && turn.contributions.length > 0 && <ContributionsBar contributions={turn.contributions} />}
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/80 mb-2">
                aggrai&apos;s answer <span className="ml-1 normal-case tracking-normal text-white/55 font-medium">· combined from all models</span>
              </p>
              <Md>{turn.summary}</Md>
            </div>
            {turn.answers.some((a) => a.scores) && (
              <div className="min-w-0"><SharedScores answers={turn.answers} /></div>
            )}
          </div>
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

export function SharedConversation({ snapshot }: { snapshot: ShareSnapshot }) {
  // Newest turn first, mirroring the app (which renders the follow-up thread
  // reversed, latest under its top composer). The STORED snapshot stays
  // chronological (root first) — the fork endpoint seeds turns in that order —
  // so we reverse for DISPLAY only.
  const turns = [...snapshot.turns].reverse();
  return (
    <div className="space-y-10">
      {turns.map((turn, i) => (
        <div key={i} className={i > 0 ? "border-t border-white/10 pt-10" : ""}>
          <Turn turn={turn} />
        </div>
      ))}
    </div>
  );
}
