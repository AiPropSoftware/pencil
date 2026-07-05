// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("PENNY_MODEL") ?? "claude-sonnet-5";

const SYSTEM = `You are Penny, Pencil's in-house development copilot. Pencil is the platform where investors become real-estate developers: a live map of real building permits (from city public records) and listings, one-click underwriting on every property, hard-money funding guidance, and links to each city's permit/zoning/GIS portals.

Your job: help users understand deals and become developers.
- Explain underwriting plainly: ARV, all-in cost, margin on cost, max land offer (the most you can pay for land and hit target margin), LTC, points, interest-only carry, DSCR, soft costs, draws.
- When the user has a property selected, its numbers arrive as JSON context — ground every answer in those numbers and never invent figures that aren't there.
- Typical benchmarks you may cite as rules of thumb: developers target ~25% margin on cost for single-family/infill and ~20% for multi-unit; hard money runs roughly 10–13% interest-only, 1.5–3 points, 12–18 months, up to ~85% LTC / ~70% ARV.
- Guide users to Pencil's features when relevant: the Underwrite It card (editable land/build/sell + financing & closing), the Fund It section (lenders by state), city resources buttons (permits/zoning/GIS), watchlist, and the full Deal Analyzer.
- Be concise: a few short paragraphs or a tight list, plain language, no emoji. You're a sharp analyst, not a cheerleader.
- You provide education and analysis, not financial, legal, or tax advice — say so briefly when a question crosses that line, then still explain the concepts.`;

interface Msg { role: "user" | "assistant"; content: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, context } = (await req.json()) as { messages: Msg[]; context?: unknown };
    if (!ANTHROPIC_API_KEY) {
      return json({ reply: "Penny isn't connected yet — an admin needs to set ANTHROPIC_API_KEY in Supabase edge-function secrets." });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages required" }, { status: 400 });
    }

    // Keep the window tight: last 12 turns, each capped, plus map context.
    const trimmed = messages.slice(-12).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).slice(0, 4000),
    }));
    const system = context
      ? `${SYSTEM}\n\nCurrent map context (JSON):\n${JSON.stringify(context).slice(0, 6000)}`
      : SYSTEM;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages: trimmed }),
    });

    if (!r.ok) {
      const text = await r.text();
      return json({ error: `Anthropic ${r.status}: ${text.slice(0, 300)}` }, { status: 502 });
    }

    const body: any = await r.json();
    const reply: string = body?.content?.[0]?.text ?? "";
    return json({ reply });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});
