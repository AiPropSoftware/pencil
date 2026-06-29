import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export default function SignUp() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="container py-20 max-w-md">
        <Card>
          <CardHeader>
            <div className="gold-rule" />
            <CardTitle className="mt-3">Accounts aren’t live yet</CardTitle>
            <CardDescription>
              Creating an account needs a backend. Add VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY in Vercel to turn on real sign-up and
              deal-saving. In the meantime, the whole app is explorable in
              demo mode.
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase()!;
    setLoading(true);
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/deal-analyzer`,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your inbox to confirm your email.");
    navigate("/sign-in");
  };

  const handleGoogle = async () => {
    const sb = getSupabase()!;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/deal-analyzer` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="container py-20 max-w-md">
      <Card>
        <CardHeader>
          <div className="gold-rule" />
          <CardTitle className="mt-3 text-3xl">Start free trial</CardTitle>
          <CardDescription>14 days of Pencil Pro. No credit card.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" /> or email <div className="flex-1 h-px bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link to="/sign-in" className="text-gold hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
