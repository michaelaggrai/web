import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server-admin";
import { getStripe, priceIdFor } from "@/lib/stripe/server";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Creates (or reuses) a Stripe customer and opens a subscription in
// `default_incomplete`, so the browser confirms the first payment with the
// Payment Element. The webhook flips entitlement once payment actually
// succeeds — this route never grants a tier on its own.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tier = body?.tier;
  const cycle = body?.cycle;
  if ((tier !== "pro" && tier !== "premium") || (cycle !== "monthly" && cycle !== "annual")) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = priceIdFor(tier, cycle);
  if (!priceId) {
    return NextResponse.json({ error: "Price not configured for this plan" }, { status: 500 });
  }

  // Caller must be signed in.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const stripe = getStripe();
  const admin = createAdminClient();

  // Reuse this user's Stripe customer if they've started checkout before.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
  }

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.confirmation_secret"],
    metadata: { user_id: user.id, tier, cycle },
  });

  // Persist the customer↔user mapping immediately (status: incomplete) so the
  // webhook can resolve the user even on the very first event.
  await admin.from("subscriptions").upsert({
    user_id: user.id,
    tier,
    cycle,
    status: subscription.status,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });

  // Stripe API 2026-04-22 (dahlia, pinned by stripe-node v22): the first-payment
  // client secret lives on invoice.confirmation_secret — the old
  // latest_invoice.payment_intent field is gone. The frontend Payment Element
  // confirms against this secret.
  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const clientSecret = invoice.confirmation_secret?.client_secret ?? null;

  return NextResponse.json({
    subscriptionId: subscription.id,
    clientSecret,
  });
}
