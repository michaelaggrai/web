// AGG-40: metadata for /upgrade. page.tsx is a client component so
// metadata has to come from this server-component layout.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upgrade your plan — aggrai",
  description:
    "Unlock more AI models per comparison. Pro gives you 16 flagships, Premium gives you 9 reasoning specialists with the ability to compare 5 at once.",
  openGraph: {
    title: "Upgrade your plan — aggrai",
    description:
      "Pro: every flagship model. Premium: deep-research reasoning specialists.",
    url: "/upgrade",
  },
};

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
