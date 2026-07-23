// AGG-40: metadata for /models. Public catalogue page — wants SEO.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI models on aggrai — full catalogue",
  description:
    "40+ models from 15 providers (Anthropic, OpenAI, Google, xAI, Meta, Mistral, DeepSeek, Qwen, Moonshot, Zhipu, MiniMax, NVIDIA, Xiaomi, Tencent, StepFun) grouped by capability. See which models are available on Free, Pro, and Premium tiers.",
  openGraph: {
    title: "AI models on aggrai — full catalogue",
    description:
      "40+ models from Anthropic, OpenAI, Google, xAI, Meta, Mistral, DeepSeek, Qwen, Moonshot, Zhipu, MiniMax, NVIDIA, Xiaomi, Tencent, StepFun — all in one comparison tool.",
    url: "/models",
  },
};

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
