// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/**
 * Stripe webhook receiver. Verifies the signature, then upserts the user's
 * subscription row and grants/revokes the 'pro' role on subscription state
 * transitions.
 *
 * Note: this function MUST be deployed with `--no-verify-jwt` because Stripe
 * calls it without a Supabase JWT. The signature header is our auth.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe not configured", { status: 503 });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });
  const raw = await req.text();

  if (!(await verifySignature(raw, sig, STRIPE_WEBHOOK_SECRET))) {
    return new Response("invalid signature", { status: 400 });
  }

  const event = JSON.parse(raw);
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        if (!userId || !subscriptionId) break;

        const sub = await stripeGet(`/v1/subscriptions/${subscriptionId}`);
        await upsertSubscription(sb, userId, customerId, sub);
        await grantPro(sb, userId);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;
        await upsertSubscription(sb, userId, sub.customer, sub);
        if (sub.status === "active" || sub.status === "trialing") await grantPro(sb, userId);
        else if (sub.status === "canceled" || sub.status === "unpaid") await revokePro(sb, userId);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;
        await sb.from("subscriptions").update({
          status: "canceled",
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
        await revokePro(sb, userId);
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook handler error", e);
    return new Response("handler error", { status: 500 });
  }
});

async function stripeGet(path: string) {
  const r = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!r.ok) throw new Error(`Stripe ${r.status}`);
  return await r.json();
}

async function upsertSubscription(sb: any, userId: string, customerId: string, sub: any) {
  await sb.from("subscriptions").upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: sub.items?.data?.[0]?.price?.id ?? null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
}

async function grantPro(sb: any, userId: string) {
  // Idempotent — user_roles has a unique (user_id, role) constraint.
  await sb.from("user_roles").upsert(
    { user_id: userId, role: "pro" },
    { onConflict: "user_id,role", ignoreDuplicates: true },
  );
}

async function revokePro(sb: any, userId: string) {
  await sb.from("user_roles").delete().eq("user_id", userId).eq("role", "pro");
}

/**
 * Stripe signature scheme: header is `t=<timestamp>,v1=<hexHmac>`.
 * Signed payload = `<timestamp>.<rawBody>`, HMAC-SHA256 with the webhook secret.
 * Constant-time compare avoids timing leaks.
 */
async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(expected, v1);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
