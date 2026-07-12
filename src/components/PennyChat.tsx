/**
 * Penny — Pencil's in-house development copilot, powered by Claude.
 * Lives on the map page as a floating assistant: ask about the selected
 * property's numbers, underwriting terms, permits, zoning, or financing
 * without ever leaving the map.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "@/integrations/supabase/client";
import { Sparkles, X, SendHorizonal } from "lucide-react";

export interface PennyContext {
  place: string;
  layer: string;
  property: Record<string, unknown> | null;
}

interface Msg { role: "user" | "assistant"; content: string }

const STARTERS = [
  "Is the property I selected a good deal?",
  "What does “max land offer” mean?",
  "How does a construction loan actually work?",
  "How do I pull my first permit?",
];

const STORE_KEY = "pencil:penny";

export function PennyChat({ context }: { context: PennyContext }) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as Msg[]; } catch { return []; }
  });
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [needsAuth, setNeedsAuth] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const contextRef = React.useRef(context);
  contextRef.current = context;

  React.useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30))); } catch { /* full/blocked */ }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);

    const sb = getSupabase();
    if (!sb) {
      setMessages([...next, { role: "assistant", content: "Penny needs the app's Supabase connection to think — it isn't configured in this build." }]);
      return;
    }
    const { data: sess } = await sb.auth.getSession();
    if (!sess.session) {
      setNeedsAuth(true);
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await sb.functions.invoke("penny-chat", {
        body: { messages: next, context: contextRef.current },
      });
      const reply = (data as { reply?: string; error?: string }) ?? {};
      if (error || reply.error || !reply.reply) {
        setMessages([...next, {
          role: "assistant",
          content: "I can't reach my brain right now — the penny-chat function may not be deployed yet. (Admin: `supabase functions deploy penny-chat` + set ANTHROPIC_API_KEY in Supabase secrets.)",
        }]);
      } else {
        setMessages([...next, { role: "assistant", content: reply.reply }]);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "Something went wrong on my end — try that again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[1500] flex items-center gap-2 rounded-full border border-gold/50 bg-card px-4 py-2.5 shadow-card transition-transform hover:scale-105"
        title="Ask Penny — your development copilot"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gold text-[#1a1612]"><Sparkles className="h-3.5 w-3.5" /></span>
        <span className="text-sm font-semibold text-foreground">Ask Penny</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[1500] flex w-[min(94vw,390px)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card" style={{ maxHeight: "min(72vh, 620px)" }}>
      <div className="flex items-center justify-between border-b border-border bg-gold-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-[#1a1612]"><Sparkles className="h-4 w-4" /></span>
          <div>
            <div className="text-sm font-semibold leading-tight">Penny</div>
            <div className="text-[11px] text-muted-foreground leading-tight">your development copilot</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div>
            <p className="text-sm text-muted-foreground">
              Ask me anything about a deal — pick a property first and I'll talk through its actual numbers.
            </p>
            <div className="mt-3 space-y-1.5">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="block w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-secondary">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={idx} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={
              m.role === "user"
                ? "max-w-[85%] rounded-lg rounded-br-sm bg-gold px-3 py-2 text-sm text-[#1a1612]"
                : "max-w-[85%] whitespace-pre-wrap rounded-lg rounded-bl-sm border border-border bg-background px-3 py-2 text-sm text-foreground"
            }>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              <span className="animate-pulse">Penny is thinking…</span>
            </div>
          </div>
        )}
        {needsAuth && (
          <div className="rounded-md border border-gold/40 bg-gold-muted/30 p-3 text-sm">
            <p className="text-foreground/90">Penny is free for members — sign in and pick up right where you left off.</p>
            <Link to="/sign-up" className="mt-2 inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">Sign up / Sign in</Link>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 border-t border-border px-3 py-2.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={context.property ? "Ask about this property…" : "Ask Penny anything…"}
          className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-gold/60"
        />
        <button type="submit" disabled={busy || !input.trim()} className="grid h-9 w-9 place-items-center rounded-md bg-gold text-[#1a1612] disabled:opacity-40">
          <SendHorizonal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
