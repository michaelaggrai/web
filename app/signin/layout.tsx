// AGG-40: metadata for /signin. Public signup/signin entry point.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — aggrai",
  description:
    "Sign in or create your aggrai account. No account needed for the Free tier — sign up only when you want to upgrade.",
  openGraph: {
    title: "Sign in — aggrai",
    description:
      "Sign in or create your aggrai account.",
    url: "/signin",
  },
};

export default function SigninLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
