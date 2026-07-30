// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID");          // Pro monthly price
const STRIPE_PRICE_ID_ANNUAL = Deno.env.get("STRIPE_PRICE_ID_ANNUAL"); // Pro annual price (2 months free)
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:8080";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/**
 * Creates a Stripe Checkout Session for the signed-in user. The user's
 * supabase id is stamped onto client_reference_id and the customer's metadata
 * so the webhook can match the resulting subscription back to a Pencil user
 * without a separate lookup.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
      return json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID." }, { status: 503 });
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, { status: 401 });

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userRes, error: userErr } = await sb.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "unauthorized" }, { status: 401 });
    const user = userRes.user;

    // Billing interval + trial control from the client. Annual is the plan
    // we optimize for; skipTrial is used when a trialing user converts (a
    // second trial would be nonsense). Annual falls back to monthly if the
    // annual price isn't configured yet.
    let interval = "monthly";
    let skipTrial = false;
    try {
      const parsed = await req.json();
      if (parsed?.interval === "annual") interval = "annual";
      if (parsed?.skipTrial === true) skipTrial = true;
    } catch { /* empty body is fine */ }
    const priceId = interval === "annual" && STRIPE_PRICE_ID_ANNUAL ? STRIPE_PRICE_ID_ANNUAL : STRIPE_PRICE_ID;

    // Re-use customer if we've seen them before.
    const { data: sub } = await sb
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const body = new URLSearchParams();
    body.set("mode", "subscription");
    body.set("payment_method_types[]", "card");
    body.set("line_items[0][price]", priceId);
    body.set("line_items[0][quantity]", "1");
    body.set("success_url", `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
    body.set("cancel_url", `${APP_URL}/?canceled=1`);
    body.set("client_reference_id", user.id);
    body.set("subscription_data[metadata][supabase_user_id]", user.id);
    body.set("allow_promotion_codes", "true");
    // 7-day free trial, no card up front: checkout skips payment collection,
    // and a trial that ends without a card cancels cleanly instead of
    // dangling as an incomplete subscription. Conversions (skipTrial) go
    // straight to payment.
    if (!skipTrial) {
      body.set("subscription_data[trial_period_days]", "7");
      body.set("payment_method_collection", "if_required");
      body.set("subscription_data[trial_settings][end_behavior][missing_payment_method]", "cancel");
    }
    if (sub?.stripe_customer_id) {
      body.set("customer", sub.stripe_customer_id);
    } else {
      body.set("customer_email", user.email ?? "");
      body.set("customer_creation", "always");
    }

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!r.ok) {
      const text = await r.text();
      return json({ error: `Stripe ${r.status}: ${text}` }, { status: 502 });
    }
    const session: any = await r.json();
    return json({ url: session.url, id: session.id });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});
