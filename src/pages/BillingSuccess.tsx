import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { getSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Stripe redirects here after a successful checkout. The webhook does the
 * actual role grant — we just poll briefly so the user sees Pro features
 * unlocked without having to refresh.
 */
export default function BillingSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { user, role } = useAuth();
  const [ready, setReady] = React.useState(role === "pro" || role === "admin");

  React.useEffect(() => {
    if (ready) return;
    const sb = getSupabase();
    if (!sb || !user) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      const { data } = await sb
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data && (data.status === "active" || data.status === "trialing")) {
        setReady(true);
        return;
      }
      if (tries < 12) setTimeout(tick, 2000); // up to ~24s
    };
    tick();
    return () => { cancelled = true; };
  }, [user, ready]);

  return (
    <div className="container py-20 max-w-md">
      <Card>
        <CardHeader>
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gold/15">
            <CheckCircle2 className="h-6 w-6 text-gold" />
          </div>
          <CardTitle className="mt-3 text-3xl">You're in.</CardTitle>
          <CardDescription>
            {ready
              ? "Pencil Pro is active. Every module is unlocked."
              : "Finalizing your subscription… this usually takes a few seconds."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="gold" className="w-full" asChild>
            <Link to="/deal-analyzer">Open the Deal Analyzer</Link>
          </Button>
          {sessionId && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Reference: {sessionId.slice(-12)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
