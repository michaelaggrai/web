"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Props = {
  height?: number;
  gradientId: string;
  className?: string;
};

/**
 * Logo + smart link. Routes signed-in users to /app (their actual home),
 * anonymous users to / (the marketing landing). Without this, every
 * page's hard-coded `<Link href="/">` sends signed-in users to a
 * landing page they don't actually use — looks broken on mobile where
 * the dark-theme parity makes the navigation feel like a no-op.
 *
 * Defaults to anonymous (href="/") until the Supabase lookup settles —
 * worst case for ~100ms an anon-default click navigates to /, then
 * resolves to /app behaviour on subsequent clicks. Same trade-off as
 * AccountMenu.
 */
export function HomeLink({ height = 28, gradientId, className }: Props) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient()
      .auth.getUser()
      .then(({ data }) => setSignedIn(!!data.user))
      .catch(() => {
        /* stay anon */
      });
  }, []);

  return (
    <Link href={signedIn ? "/app" : "/"} aria-label="aggrai" className={className}>
      <Logo height={height} gradientId={gradientId} />
    </Link>
  );
}
