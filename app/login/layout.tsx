// AGG-40: metadata for /login (the V1 beta password gate, NOT to be
// confused with /signin which is the Supabase account auth page). We
// NOINDEX this page so search engines don't surface "Enter password"
// pages in search results — once V2 lands and removes the password
// gate, this whole route goes away.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "aggrai — beta access",
  description:
    "aggrai is currently in private beta. Enter the access password to continue.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
