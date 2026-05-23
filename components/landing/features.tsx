import { Check, Minus, AlertCircle, Sparkles } from "lucide-react"

interface ModelResponse {
  name: string
  color: string
  response: string
  agreement: "agree" | "partial" | "disagree"
}

const mockResponses: ModelResponse[] = [
  {
    name: "Claude",
    color: "#00B5A3",
    response: "Climate change is primarily caused by human activities, particularly the burning of fossil fuels...",
    agreement: "agree"
  },
  {
    name: "GPT-4o",
    color: "#10B981",
    response: "The scientific consensus strongly supports anthropogenic climate change as the dominant driver...",
    agreement: "agree"
  },
  {
    name: "Gemini",
    color: "#3B82F6",
    response: "Human-induced climate change is well-documented, with CO2 emissions being the primary factor...",
    agreement: "agree"
  },
  {
    name: "Mistral",
    color: "#F59E0B",
    response: "While natural factors play a role, human activities are the main contributor to recent warming...",
    agreement: "partial"
  },
  {
    name: "Llama",
    color: "#EC4899",
    response: "Evidence points to human activity as the primary cause of observed climate changes...",
    agreement: "agree"
  }
]

function AgreementIcon({ agreement }: { agreement: ModelResponse["agreement"] }) {
  switch (agreement) {
    case "agree":
      return <Check className="w-3.5 h-3.5 text-emerald-500" />
    case "partial":
      return <Minus className="w-3.5 h-3.5 text-amber-500" />
    case "disagree":
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />
  }
}

function ResultsMockup() {
  return (
    <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-xl shadow-black/5">
      {/* Search bar */}
      <div className="p-5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3 bg-background rounded-xl px-4 py-3 border border-border">
          <Sparkles className="w-4 h-4 text-teal-500" />
          <span className="text-sm text-foreground">What causes climate change?</span>
        </div>
      </div>
      
      {/* Results */}
      <div className="divide-y divide-border">
        {mockResponses.map((model) => (
          <div key={model.name} className="p-5 hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-3.5">
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-semibold shrink-0 shadow-sm"
                style={{ backgroundColor: model.color }}
              >
                {model.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-medium text-foreground text-sm">{model.name}</span>
                  <AgreementIcon agreement={model.agreement} />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {model.response}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricsExplanation() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-3xl sm:text-4xl font-semibold text-foreground leading-tight">
          See the full
          <br />
          <span className="bg-gradient-to-r from-teal-500 to-teal-400 bg-clip-text text-transparent">picture</span>
        </h3>
        <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
          Query multiple AI models at once and instantly see where they agree or differ.
        </p>
      </div>

      <div className="space-y-5">
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Check className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h4 className="font-medium text-foreground">Agreement Score</h4>
            <p className="text-sm text-muted-foreground mt-1">
              See when models reach the same conclusion.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Minus className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h4 className="font-medium text-foreground">Nuanced Differences</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Spot subtle differences in interpretation.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h4 className="font-medium text-foreground">Conflicting Views</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Know when to dig deeper on complex topics.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Features() {
  return (
    <section id="features" className="py-24 bg-background scroll-mt-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <ResultsMockup />
          </div>
          <div className="order-1 lg:order-2">
            <MetricsExplanation />
          </div>
        </div>
      </div>
    </section>
  )
}
