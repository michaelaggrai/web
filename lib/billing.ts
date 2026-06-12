// Shadow-mode switch for the real Stripe billing flow.
//
// While this is false (the default — env var unset), the public site keeps
// showing the demo/disabled checkout and Settings keeps rendering the
// billing-demo mock. The real Payment Element + webhook entitlement path only
// activates when NEXT_PUBLIC_BILLING_LIVE === "true". Flip it (in env) once
// Stripe is wired and tested with a test card. NEXT_PUBLIC_ so client
// components can gate their UI on it.
export const BILLING_LIVE = process.env.NEXT_PUBLIC_BILLING_LIVE === "true";
