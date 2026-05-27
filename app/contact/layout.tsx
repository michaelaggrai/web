// AGG-40: metadata for /contact.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact aggrai",
  description:
    "Get in touch with the team behind aggrai. Bug reports, feedback, partnerships, and feature requests welcome.",
  openGraph: {
    title: "Contact aggrai",
    description:
      "Bug reports, feedback, partnerships, and feature requests welcome.",
    url: "/contact",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
