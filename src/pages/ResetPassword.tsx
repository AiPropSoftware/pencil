import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabase } from "@/integrations/supabase/client";

/**
 * Landing page for the password-recovery email link. Supabase processes the
 * token in the URL into a session (detectSessionInUrl), then the user sets a
 * new password here. Expired/used links arrive with an #error= hash instead
 * of a token — shown honestly with a path back to requesting a fresh one.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const sb = getSupabase();
  const [ready, setReady] = React.useState<"checking" | "ok" | "invalid">("checking");
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!sb) { setReady("invalid"); return; }
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error")) {
      const desc = hash.get("error_description");
      setLinkError(desc ? desc.replace(/\+/g, " ") : null);
      setReady("invalid");
      return;
    }
    // The token→session exchange happens asynchronously after load, so poll
    // briefly instead of failing the instant the page renders.
    let cancelled = false;
    const started = Date.now();
    const tick = async () => {
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      if (data.session) { setReady("ok"); return; }
      if (Date.now() - started > 6000) { setReady("invalid"); return; }
      window.setTimeout(tick, 300);
    };
    void tick();
    return () => { cancelled = true; };
  }, [sb]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Use at least 8 characters."); return; }
    if (password !== confirm) { toast.error("Passwords don't match."); return; }
    setSaving(true);
    const { error } = await sb!.auth.updateUser({ password });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated — you're signed in.");
    navigate("/map", { replace: true });
  };

  return (
    <div className="container py-20 max-w-md">
      <Card>
        <CardHeader>
          <div className="gold-rule" />
          <CardTitle className="mt-3 text-3xl">Set a new password</CardTitle>
          <CardDescription>
            {ready === "ok" ? "You're verified — choose a new password for your account." : "Checking your reset link…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ready === "checking" && (
            <p className="text-sm text-muted-foreground animate-pulse">Verifying…</p>
          )}
          {ready === "invalid" && (
            <div className="space-y-3">
              <p className="text-sm text-foreground/90">
                {linkError ?? "This reset link is invalid or has expired."} Reset links are single-use
                and expire quickly — request a fresh one and use it right away.
              </p>
              <Button variant="gold" className="w-full" asChild>
                <Link to="/sign-in">Request a new reset link</Link>
              </Button>
            </div>
          )}
          {ready === "ok" && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" required minLength={8} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input id="confirm-password" type="password" required minLength={8} autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" variant="gold" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Save new password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
