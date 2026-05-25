import type { Metadata, Viewport } from "next";
import { Geist, Montserrat } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-montserrat",
});

// metadataBase lets Next.js resolve relative OG / Twitter image URLs.
// Set to the canonical prod hostname; previews on Vercel preview URLs
// still work (the helper falls back to the request origin).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aggrai.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Aggrai — Ask every AI at once",
    template: "%s",
  },
  description: "Compare answers from multiple AI models side by side, with a unified summary.",
  applicationName: "Aggrai",
  keywords: [
    "AI comparison",
    "LLM comparison",
    "ChatGPT vs Claude",
    "GPT-4o",
    "Claude Sonnet",
    "Gemini",
    "multi-model AI",
  ],
  authors: [{ name: "Aggrai" }],
  // openGraph + twitter make link previews in Slack / WhatsApp / Twitter
  // / iMessage actually look like a product instead of a bare URL.
  openGraph: {
    type: "website",
    siteName: "Aggrai",
    title: "Aggrai — Ask every AI at once",
    description: "Compare answers from multiple AI models side by side, with a unified summary.",
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aggrai — Ask every AI at once",
    description: "Compare answers from multiple AI models side by side, with a unified summary.",
    creator: "@aggrai",
  },
  // app/icon.svg is auto-picked up by Next.js conventions; declaring
  // explicitly here makes it discoverable + lets us add additional
  // icon sizes later without changing the layout.
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

// Mobile-first viewport. viewport-fit=cover so the navy gradient bleeds
// behind the iOS notch / dynamic-island instead of leaving a white bar.
// colorScheme=dark tells iOS to render form controls + scrollbars in
// dark mode. themeColor stains the iOS / Android status bar to match
// our navy so the OS chrome doesn't fight the brand.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16224A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${montserrat.variable}`}>
      {/* Body bg is navy to match every page's wrapper — eliminates the
          flash-of-white on first paint and the white iOS overscroll bounce. */}
      <body className={`${geist.className} min-h-full bg-navy text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
