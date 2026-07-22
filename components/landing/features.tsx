import { Trophy, Layers, BarChart3 } from "lucide-react"
import { AnthropicIcon, OpenAIIcon, GoogleIcon } from "@/components/brand-icons"

// Mockup of the headline results UI shown in /app — a Summary card with
// contributions + aggrai's answer, then the Aggr-Score block (winner marked
// with a trophy). Static content; matches the real product shape so the
// marketing visual stays honest as the product evolves.
function ResultsMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-1 backdrop-blur-xl p-4 sm:p-5 shadow-2xl shadow-black/30 space-y-3">
      {/* Question */}
      <div className="text-xs text-white/55">
        <span className="text-white/55">You asked:</span> Why do recessions hurt the poor more?
      </div>

      {/* Summary card with contributions + aggrai's answer */}
      <div className="rounded-xl border border-white/10 bg-surface-2 p-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Layers className="w-3 h-3 text-teal-300" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/80">Summary</p>
        </div>

        {/* Contribution bars */}
        <div className="space-y-1.5 mb-3 pb-3 border-b border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55 mb-1">Where the summary came from</p>
          <ContribRow Icon={AnthropicIcon} label="Claude Sonnet 5" pct={48} />
          <ContribRow Icon={GoogleIcon}    label="Gemini 2.5 Pro"    pct={32} />
          <ContribRow Icon={OpenAIIcon}    label="GPT-4o"             pct={20} />
        </div>

        {/* aggrai's answer */}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/80 mb-1">
          aggrai&apos;s answer
        </p>
        <p className="text-[11px] text-white/70 leading-relaxed">
          Recessions hurt the poor more fundamentally because poverty itself is a state of economic fragility—one without buffers, options, or recovery assets…
        </p>
      </div>

      {/* Quality scores mini block */}
      <div className="rounded-xl border border-white/10 bg-surface-2 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <BarChart3 className="w-3 h-3 text-teal-300" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/80">Aggr-Score</p>
        </div>
        <div className="space-y-1.5">
          <ScoreRow Icon={AnthropicIcon} label="Claude Sonnet 5" score={9.2} winner />
          <ScoreRow Icon={GoogleIcon}    label="Gemini 2.5 Pro"    score={8.6} />
          <ScoreRow Icon={OpenAIIcon}    label="GPT-4o"             score={8.1} />
        </div>
      </div>
    </div>
  )
}

function ContribRow({ Icon, label, pct }: { Icon: typeof AnthropicIcon; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon className="w-2.5 h-2.5 shrink-0 text-white/70" />
      <span className="text-white/60 truncate w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-400/80 to-teal-300/80"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-white/50 tabular-nums w-7 text-right shrink-0">{pct}%</span>
    </div>
  )
}

function ScoreRow({ Icon, label, score, winner = false }: { Icon: typeof AnthropicIcon; label: string; score: number; winner?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon className="w-2.5 h-2.5 shrink-0 text-white/70" />
      {winner && <Trophy className="w-2.5 h-2.5 shrink-0 text-teal-300" aria-hidden="true" />}
      <span className="text-white/60 truncate flex-1 min-w-0">{label}</span>
      <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full ${winner ? "bg-gradient-to-r from-teal-400 to-teal-300" : "bg-white/30"}`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className={`tabular-nums w-6 text-right shrink-0 ${winner ? "text-teal-300 font-semibold" : "text-white/50"}`}>{score.toFixed(1)}</span>
    </div>
  )
}

function FeaturesExplanation() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
          One answer.{" "}
          <span className="bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">
            All the models.
          </span>
        </h3>
        <p className="mt-4 text-white/60 text-base sm:text-lg leading-relaxed">
          aggrai sends your question to multiple AI models in parallel, scores each answer,
          and synthesises a single best answer using the strongest content from each.
        </p>
      </div>

      <div className="space-y-4">
        <FeatureRow
          Icon={Layers}
          title="aggrai's answer"
          body="A rewritten answer drawn from all the models, weighted by how well each one performed. Read this and skip the noise."
        />
        <FeatureRow
          Icon={BarChart3}
          title="Aggr-Score"
          body="Every answer is judged on accuracy, completeness, calibration, clarity and insight — each the average of three specific checks — then combined into a single score out of 10. So you can see why the synthesis chose what it chose."
        />
        <FeatureRow
          Icon={Trophy}
          title="A clear winner"
          body="The highest-scoring model is marked with a trophy, so if you want to keep going with one model, you know which had the best answer for this question."
        />
      </div>
    </div>
  )
}

function FeatureRow({ Icon, title, body }: { Icon: typeof Trophy; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3.5 p-4 rounded-xl bg-surface-1 border border-white/10">
      <div className="w-9 h-9 rounded-lg bg-teal-400/10 border border-teal-400/20 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-teal-300" />
      </div>
      <div>
        <h4 className="font-semibold text-white text-sm">{title}</h4>
        <p className="text-sm text-white/55 mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

export function Features() {
  return (
    <section
      id="features"
      className="relative py-24 sm:py-28 bg-navy scroll-mt-20 overflow-hidden"
    >
      {/* Soft accent orbs to match the rest of the dark sections */}
      <div className="pointer-events-none absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[140px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-teal-500/8 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="order-2 lg:order-1">
            <ResultsMockup />
          </div>
          <div className="order-1 lg:order-2">
            <FeaturesExplanation />
          </div>
        </div>
      </div>

    </section>
  )
}
