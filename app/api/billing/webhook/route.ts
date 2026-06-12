import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planForPriceId, type PaidTier } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/server-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createAdminClient>;
type CycleVal = "monthly" | "annual";

// Stripe is the source of truth for entitlement. Verify the signature, then
// write profiles.tier (what the backend reads) + the subscriptions row (what
// Settings renders). Stripe retries failed deliveries, so returning 500 on a
// transient error is safe.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(admin, event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.paid": {
        // Renewals: re-sync the row from the subscription it paid.
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as { subscription?: string | Stripe.Subscription }).subscription;
        if (subId) {
          const sub = await getStripe().subscriptions.retrieve(
            typeof subId === "string" ? subId : subId.id,
          );
          await syncSubscription(admin, sub);
        }
        break;
      }
      default:
        break; // ignore everything else
    }
  } catch (err) {
    console.error(`stripe webhook handler error for ${event.type}`, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Resolve the Stripe subscription to our user + plan and persist it.
async function syncSubscription(admin: Admin, sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price?.id;
  const plan = priceId ? planForPriceId(priceId) : null;
  const tier = (sub.metadata?.tier as PaidTier | undefined) ?? plan?.tier;
  const cycle = (sub.metadata?.cycle as CycleVal | undefined) ?? plan?.cycle;

  let userId: string | undefined = sub.metadata?.user_id;
  if (!userId) {
    // No metadata mapping — fall back to the customer id we stored at creation.
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.user_id as string | undefined;
  }
  if (!userId) {
    console.warn("stripe webhook: no user mapping for subscription", sub.id);
    return;
  }

  const active = sub.status === "active" || sub.status === "trialing";
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  // API 2026-04-22 (dahlia): current_period_end moved off the Subscription onto
  // each subscription item. Single-item subs → read it from the first item.
  const periodEnd = sub.items.data[0]?.current_period_end;

  if (tier && cycle) {
    await admin.from("subscriptions").upsert({
      user_id: userId,
      tier,
      cycle,
      status: sub.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    });
  }

  // Entitlement: the backend reads profiles.tier. Active paid sub → that tier;
  // canceled / unpaid / incomplete → free.
  await admin.from("profiles").update({ tier: active && tier ? tier : "free" }).eq("id", userId);

  // Make the new tier take effect immediately instead of waiting on the
  // backend's 1h account-cache TTL. The webhook has no user JWT, so it
  // authenticates with the shared service secret. Best-effort: if it fails (or
  // the secret isn't set yet) the TTL is the fallback, so we never throw here.
  const serviceSecret = process.env.INTERNAL_API_SECRET;
  if (serviceSecret) {
    const apiUrl = process.env.API_URL ?? "http://localhost:3456";
    try {
      const r = await fetch(`${apiUrl}/invalidate-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-aggrai-service-secret": serviceSecret },
        body: JSON.stringify({ userId }),
      });
      if (!r.ok) console.warn(`invalidate-account (service) returned HTTP ${r.status} for ${userId}`);
    } catch (err) {
      console.warn("invalidate-account (service) fetch failed", err);
    }
  }
}
