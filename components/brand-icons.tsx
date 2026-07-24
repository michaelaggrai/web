// Brand icons for the AI providers, shared by the model picker and the
// per-model loading animation.

type IconProps = { className?: string; style?: React.CSSProperties }

export function AnthropicIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-3.654 0H6.57L0 20h3.603l1.378-3.504h6.947l1.378 3.504h3.603L10.173 3.52zm-1.677 9.979H4.52l2.013-5.115 2.013 5.115z" />
    </svg>
  )
}

export function OpenAIIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.843-3.372L15.114 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.402-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z"/>
    </svg>
  )
}

export function GoogleIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export function MistralIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="5.6" height="5.6" />
      <rect x="9.2" y="0" width="5.6" height="5.6" />
      <rect x="18.4" y="0" width="5.6" height="5.6" />
      <rect x="0" y="9.2" width="5.6" height="5.6" />
      <rect x="9.2" y="9.2" width="5.6" height="5.6" />
      <rect x="18.4" y="9.2" width="5.6" height="5.6" />
      <rect x="9.2" y="18.4" width="5.6" height="5.6" />
      <rect x="18.4" y="18.4" width="5.6" height="5.6" />
    </svg>
  )
}

export function MetaIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973.14.604.375 1.128.73 1.536.356.408.863.634 1.485.634.476 0 .928-.113 1.314-.343.386-.23.741-.572 1.079-1.022.338-.45.677-.995 1.021-1.619s.68-1.32.982-2.064c.302-.744.581-1.54.836-2.377.255-.837.476-1.69.664-2.549.025-.11.05-.218.073-.326.024-.108.048-.215.072-.322l.06-.252.06-.25c.02-.085.04-.168.062-.25.04-.161.082-.319.123-.476.082-.314.169-.617.262-.906.093-.29.192-.564.297-.819.105-.255.215-.493.33-.713.115-.22.234-.423.358-.603a3.54 3.54 0 0 1 .39-.497c.14-.143.283-.255.43-.334.147-.08.298-.12.457-.12.186 0 .345.045.483.128.138.083.256.208.357.37.101.162.187.362.26.593.074.231.133.497.18.791.047.294.08.617.101.962.022.345.032.712.032 1.098v1.493c0 .435-.015.854-.044 1.258-.03.403-.073.793-.133 1.168-.06.375-.132.735-.22 1.08-.087.345-.187.672-.302.98-.115.307-.243.594-.385.862-.142.267-.297.514-.465.74.243.095.513.143.805.143.563 0 1.088-.15 1.572-.454.484-.303.938-.75 1.358-1.34.42-.59.804-1.323 1.148-2.2.344-.876.644-1.881.895-3.01.25-1.13.444-2.379.577-3.74.135-1.362.203-2.762.203-4.162v-.257C18.036 1.09 17.078 0 15.787 0H8.213C6.922 0 5.964 1.09 5.964 2.443V2.7c0 .46.017.92.052 1.38.035.46.086.92.151 1.376.065.456.146.909.24 1.357.095.448.205.892.329 1.33a.2.2 0 0 0 .179-.113zm10.17 0c.16 0 .31.04.457.12.147.08.29.19.43.334a3.54 3.54 0 0 1 .39.497c.124.18.243.383.358.603.115.22.225.458.33.713.105.255.204.529.297.819.093.29.18.592.262.906.041.157.083.315.123.476l.062.25.06.25.06.252.073.326c.024.107.048.214.072.322.299 1.345.647 2.627 1.04 3.838.394 1.21.843 2.29 1.348 3.235.505.945 1.065 1.699 1.68 2.262.615.563 1.283.844 2.005.844.622 0 1.13-.226 1.485-.634.356-.408.59-.932.73-1.536.14-.604.21-1.267.21-1.973 0-2.566-.704-5.241-1.944-7.306-1.188-1.833-2.903-3.113-4.871-3.113z"/>
    </svg>
  )
}

// Generic initial-in-circle icon for providers without a custom brand mark.
// Keeps the picker visually consistent when new providers get added without
// us having to fetch a logo every time.
function initialIcon(letter: string, fill: string) {
  return function InitialIcon({ className, style }: IconProps) {
    return (
      <svg className={className} style={style} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill={fill} />
        <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="white" fontFamily="ui-sans-serif, system-ui">
          {letter}
        </text>
      </svg>
    )
  }
}

export const DeepSeekIcon = initialIcon("D", "#4F6BFF")
export const QwenIcon     = initialIcon("Q", "#615CED")
export const XAIIcon      = initialIcon("X", "#111111")
export const MoonshotIcon = initialIcon("M", "#111827")
export const ZhipuIcon    = initialIcon("Z", "#1D4ED8")
export const MiniMaxIcon  = initialIcon("M", "#E5484D")
export const NvidiaIcon   = initialIcon("N", "#76B900")
export const XiaomiIcon   = initialIcon("Mi", "#FF6700")
export const TencentIcon  = initialIcon("T", "#0052D9")
export const StepFunIcon  = initialIcon("S", "#0891B2")

const BY_PROVIDER: Record<string, (p: IconProps) => React.JSX.Element> = {
  Anthropic: AnthropicIcon,
  OpenAI: OpenAIIcon,
  Google: GoogleIcon,
  Mistral: MistralIcon,
  Meta: MetaIcon,
  DeepSeek: DeepSeekIcon,
  Qwen: QwenIcon,
  xAI: XAIIcon,
  Moonshot: MoonshotIcon,
  Zhipu: ZhipuIcon,
  MiniMax: MiniMaxIcon,
  NVIDIA: NvidiaIcon,
  Xiaomi: XiaomiIcon,
  Tencent: TencentIcon,
  StepFun: StepFunIcon,
}

// Provider derived from the model-id prefix (e.g. "anthropic/claude-..." → "Anthropic")
const PROVIDER_BY_PREFIX: Record<string, string> = {
  "anthropic": "Anthropic",
  "openai": "OpenAI",
  "google": "Google",
  "mistralai": "Mistral",
  "meta-llama": "Meta",
  "deepseek": "DeepSeek",
  "qwen": "Qwen",
  "x-ai": "xAI",
  "moonshotai": "Moonshot",
  "z-ai": "Zhipu",
  "minimax": "MiniMax",
  "nvidia": "NVIDIA",
  "xiaomi": "Xiaomi",
  "tencent": "Tencent",
  "stepfun": "StepFun",
}

export function providerOf(modelId: string): string {
  const prefix = modelId.split("/")[0]
  // Fall back to a Title-cased prefix (not "Anthropic") so an unmapped provider
  // is never mis-attributed to another brand.
  return PROVIDER_BY_PREFIX[prefix] ?? (prefix ? prefix[0].toUpperCase() + prefix.slice(1) : "Unknown")
}

export function ProviderLogo({ provider, className, style }: { provider: string } & IconProps) {
  const Icon = BY_PROVIDER[provider]
  if (Icon) return <Icon className={className} style={style} />
  // Neutral fallback: an initial-in-circle for any provider without a brand
  // mark, so it never borrows another brand's logo (this previously defaulted
  // to the Anthropic icon — see the Xiaomi/Tencent/StepFun bug 2026-07-23).
  const letter = (provider?.trim()?.[0] ?? "?").toUpperCase()
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#64748B" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="white" fontFamily="ui-sans-serif, system-ui">{letter}</text>
    </svg>
  )
}
