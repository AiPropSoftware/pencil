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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase()!;
    setLoading(true);
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/map`,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      // Email confirmation is off — the user is signed in immediately.
      toast.success("Account created. Welcome to Pencil.");
      navigate("/map");
    } else {
      // Confirmation required — Supabase emailed a verification link.
      toast.success("Account created — confirm your email, then sign in.");
      navigate("/sign-in");
    }
  };

  return (
    <div className="container py-20 max-w-md">
      <Card>
        <CardHeader>
          <div className="gold-rule" />
          <CardTitle className="mt-3 text-3xl">Create your free account</CardTitle>
          <CardDescription>Full access to the live permit map, underwriting, and funding tools.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
