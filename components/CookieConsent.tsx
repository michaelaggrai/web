"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readConsent, writeConsent, type ConsentValue } from "@/lib/consent";

// Bottom-anchored consent banner. Shows until the user makes a choice. Accept
// and Reject are given equal visual weight (GDPR: rejecting must be as easy as
// accepting — no dark patterns). Accepting reloads so Sentry can initialise
// (see instrumentation-client.ts).
export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(readConsent() === null);
  }, []);

  if (!show) return null;

  const choose = (v: ConsentValue) => {
    writeConsent(v);
    setShow(false);
    if (v === "accepted") window.location.reload();
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:gap-4">
        <p className="text-sm leading-relaxed text-white/70">
          We use essential cookies to keep you signed in. With your OK, we also use
          error monitoring to catch and fix crashes.{" "}
          <Link href="/privacy" className="text-white/90 underline underline-offset-2 hover:text-white">
            Privacy &amp; cookies
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="flex-1 whitespace-nowrap rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 sm:flex-none"
          >
            Reject non-essential
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="flex-1 whitespace-nowrap rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-teal-300 sm:flex-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
