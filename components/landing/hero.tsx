"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Sparkles } from "lucide-react"

export function Hero() {
  const [query, setQuery] = useState("")
  const router = useRouter()

  return (
    <section className="relative min-h-[92vh] flex items-center bg-gradient-to-b from-navy via-navy to-[#252547] overflow-hidden">
      {/* Soft gradient orbs */}
      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[150px]" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 w-full">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-8">
            <Sparkles className="w-4 h-4 text-teal-300" />
            <span className="text-sm text-white/80 font-medium">Compare AI models instantly</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-[1.15]">
            Get answers from
            <br />
            <span className="bg-gradient-to-r from-teal-300 to-teal-200 bg-clip-text text-transparent">every perspective</span>
          </h1>
          <p className="mt-6 text-lg text-white/50 max-w-lg mx-auto leading-relaxed">
            Ask once, compare many. See how different AI models think about your questions.
          </p>
          
          {/* Chat input */}
          <div className="mt-10 max-w-xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""
                router.push(`/app${params}`)
              }}
              className="relative"
            >
              <div className="flex items-center bg-white/[0.08] backdrop-blur-xl rounded-2xl border border-white/10 hover:border-white/20 transition-colors shadow-2xl shadow-black/20">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What would you like to know?"
                  className="flex-1 bg-transparent text-white placeholder:text-white/30 px-6 py-5 text-base focus:outline-none rounded-2xl"
                />
                <button
                  type="submit"
                  className="m-2 bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-400 text-white p-3.5 rounded-xl transition-all shadow-lg shadow-teal-500/25"
                  aria-label="Submit query"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
              
              {/* Example prompts */}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {["Explain quantum computing", "Compare programming languages", "What is machine learning?"].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => router.push(`/app?q=${encodeURIComponent(prompt)}`)}
                    className="text-sm text-white/40 hover:text-white/70 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
