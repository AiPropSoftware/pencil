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

  const handleGoogle = async () => {
    const sb = getSupabase()!;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${from}` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="container py-20 max-w-md">
      <Card>
        <CardHeader>
          <div className="gold-rule" />
          <CardTitle className="mt-3 text-3xl">Welcome back</CardTitle>
          <CardDescription>Sign in to continue underwriting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" /> or email <div className="flex-1 h-px bg-border" />
          </div>
          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center">
            Don't have an account?{" "}
            <Link to="/sign-up" className="text-gold hover:underline">Start free trial</Link>
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
            <Link to="/deal-analyzer">Try the Deal Analyzer →</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/admin">Explore the admin view (demo)</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
