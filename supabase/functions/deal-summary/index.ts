// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";

const SYSTEM = `You are an underwriter writing a one-page deal memo for a capital partner.
Style: terse, banker-grade, no fluff, no emoji, no marketing language.
Structure: 1) one-line thesis, 2) capital stack, 3) projected returns, 4) key risks (one line each), 5) what would have to be true for this deal to fail.
Use plain numbers ($1.2M not $1,200,000.00). Never invent numbers — only use what's in the JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { inputs, results } = await req.json();
    if (!ANTHROPIC_API_KEY) {
      return json({ summary: "ANTHROPIC_API_KEY not configured. Set it in Supabase secrets." }, { status: 200 });
    }

    const userContent = `Underwrite this deal and produce the memo described in the system prompt.

Inputs:
${JSON.stringify(inputs, null, 2)}

Calculated results:
${JSON.stringify(results, null, 2)}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return json({ error: `Anthropic ${r.status}: ${text}` }, { status: 502 });
    }

    const body: any = await r.json();
    const summary: string = body?.content?.[0]?.text ?? "";
    return json({ summary });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});
