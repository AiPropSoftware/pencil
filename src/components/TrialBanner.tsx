import * as React from "react";
import { X } from "lucide-react";
import { UpgradeButton } from "@/components/UpgradeButton";
import { getSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * The annual-conversion nudge. Reads the user's own subscription row
 * (RLS: subscriptions_self_select) and shows exactly one of:
 *  - trialing:  days-left countdown + "switch to annual, 2 months free"
 *  - trial over (sub exists but is no longer active): win-back annual pitch
 * Dismissal is per-session so it returns tomorrow without nagging today.
 */
export function TrialBanner() {
  const { user, role, configured } = useAuth();
  const [sub, setSub] = React.useState<{ status: string; current_period_end: string | null } | null>(null);
  const [dismissed, setDismissed] = React.useState(() => sessionStorage.getItem("pencil-trial-banner") === "1");

  React.useEffect(() => {
    if (!configured || !user) return;
    let alive = true;
    getSupabase()!
      .from("subscriptions")
      .select("status,current_period_end")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setSub(data ?? null);
      });
    return () => {
      alive = false;
    };
  }, [configured, user?.id]);

  if (dismissed || !user || !sub || role === "admin") return null;

  const trialing = sub.status === "trialing";
  const ended = ["canceled", "incomplete_expired", "unpaid", "past_due"].includes(sub.status) && role !== "pro";
  if (!trialing && !ended) return null;

  const daysLeft = sub.current_period_end
    ? Math.max(0, Math.ceil((Date.parse(sub.current_period_end) - Date.now()) / 86_400_000))
    : null;

  const dismiss = () => {
    sessionStorage.setItem("pencil-trial-banner", "1");
    setDismissed(true);
  };

  return (
    <div className="border-b border-gold/30 bg-gold-muted/60">
      <div className="container flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
        <span className="font-medium text-foreground">
          {trialing
            ? daysLeft != null
              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your Pro trial.`
              : "You're on a Pro trial."
            : "Your Pro trial ended."}
        </span>
        <span className="text-muted-foreground">
          {trialing
            ? "Lock in annual now — 2 months free, nothing changes today."
            : "Come back on annual — 2 months free vs monthly."}
        </span>
        <UpgradeButton size="sm" interval="annual" skipTrial className="ml-auto">
          {trialing ? "Switch to annual · $1,490/yr" : "Restart on annual · $1,490/yr"}
        </UpgradeButton>
        <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
