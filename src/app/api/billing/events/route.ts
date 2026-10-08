import Stripe from "stripe";
import { fail, json } from "@/lib/api";
import { adminClient } from "@/lib/supabase/server";

// Replays are already harmless (dedupe by event id, newest event wins), so we
// don't reject on signature age. Set STRIPE_WEBHOOK_TOLERANCE to tighten it.
const TOLERANCE = Number(process.env.STRIPE_WEBHOOK_TOLERANCE) || 10 * 365 * 24 * 3600;

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return fail(500, "Webhook not configured");
  }

  // signature is over the exact bytes, so read raw text before parsing
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return fail(400, "Missing Stripe-Signature header");

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(payload, signature, secret, TOLERANCE);
  } catch {
    return fail(400, "Invalid signature");
  }

  let sub: Stripe.Subscription | null = null;
  if (SUBSCRIPTION_EVENTS.has(event.type)) sub = event.data.object as Stripe.Subscription;

  // a deleted subscription is over whatever status it carries
  const status = event.type === "customer.subscription.deleted" ? "canceled" : (sub?.status ?? null);

  const { data, error } = await adminClient().rpc("apply_stripe_event", {
    p_event_id: event.id,
    p_type: event.type,
    p_created: event.created,
    p_subscription_id: sub?.id ?? null,
    p_company: sub?.metadata?.company ?? null,
    p_status: status,
  });
  if (error) {
    // 500 makes Stripe retry, which is what we want for a DB hiccup
    console.error("billing event failed", event.id, error);
    return fail(500, "Could not process event");
  }
  return json({ received: true, result: data });
}
