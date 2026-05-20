export function SocialProof() {
  const models = [
    { name: "Claude", icon: "C" },
    { name: "GPT-4o", icon: "G" },
    { name: "Gemini", icon: "G" },
    { name: "Mistral", icon: "M" },
    { name: "Llama", icon: "L" },
    { name: "Grok", icon: "X" },
  ]

  return (
    <section className="py-16 bg-gradient-to-b from-[#252547] to-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-muted-foreground mb-8">
          Works with all major AI models
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {models.map((model) => (
            <div
              key={model.name}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-muted/50 border border-border hover:border-border/80 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-500/20 to-teal-500/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-foreground/70">{model.icon}</span>
              </div>
              <span className="text-sm font-medium text-foreground/80">{model.name}</span>
            </div>
          ))}
          <div className="px-4 py-2.5 rounded-full bg-gradient-to-r from-teal-500/10 to-teal-500/5 border border-teal-500/20">
            <span className="text-sm font-medium bg-gradient-to-r from-teal-500 to-teal-400 bg-clip-text text-transparent">+20 more</span>
          </div>
        </div>
      </div>
    </section>
  )
}
