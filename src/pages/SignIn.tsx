import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/deal-analyzer";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [mode, setMode] = React.useState<"signin" | "forgot">("signin");
  const [resetSent, setResetSent] = React.useState(false);

  if (!isSupabaseConfigured()) return <NotConfigured />;

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase()!;
    setLoading(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate(from, { replace: true });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase()!;
    setLoading(true);
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setResetSent(true);
  };

  if (mode === "forgot") {
    return (
      <div className="container py-20 max-w-md">
        <Card>
          <CardHeader>
            <div className="gold-rule" />
            <CardTitle className="mt-3 text-3xl">Reset your password</CardTitle>
            <CardDescription>We'll email you a link to set a new one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resetSent ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground/90">
                  If an account exists for <span className="font-medium">{email}</span>, a reset link
                  is on its way — check your inbox (and spam). The link is single-use and expires
                  quickly, so open it soon.
                </p>
                <Button variant="outline" className="w-full" onClick={() => { setMode("signin"); setResetSent(false); }}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" type="email" required autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Email me a reset link"}
                </Button>
                <button type="button" onClick={() => setMode("signin")}
                  className="block w-full text-center text-sm text-muted-foreground hover:text-foreground">
                  Back to sign in
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-20 max-w-md">
      <Card>
        <CardHeader>
          <div className="gold-rule" />
          <CardTitle className="mt-3 text-3xl">Welcome back</CardTitle>
          <CardDescription>Sign in to continue underwriting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={() => setMode("forgot")}
                  className="text-xs text-gold hover:underline">
                  Forgot password?
                </button>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center">
            Don't have an account?{" "}
            <Link to="/sign-up" className="text-gold hover:underline">Sign up free</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="container py-20 max-w-md">
      <Card>
        <CardHeader>
          <div className="gold-rule" />
          <CardTitle className="mt-3">Accounts aren’t live yet</CardTitle>
          <CardDescription>
            Sign-in needs a backend. Add VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY in Vercel to enable real accounts. Until
            then, the whole app is explorable in demo mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="gold" className="w-full" asChild>
            <Link to="/map">Open the development map →</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/deal-analyzer">Try the Deal Analyzer</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
