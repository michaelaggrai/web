import type { Metadata, Viewport } from "next";
import { Geist, Montserrat } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "Aggrai — Ask every AI at once",
  description: "Compare answers from multiple AI models side by side, with a unified summary.",
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
