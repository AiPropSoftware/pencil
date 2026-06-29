import * as React from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { getSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

interface Props extends Omit<ButtonProps, "onClick"> {
  children?: React.ReactNode;
}

export function UpgradeButton({ children = "Upgrade to Pro", ...props }: Props) {
  const { user, configured } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const start = async () => {
    if (!configured) {
      toast.error("Supabase not configured.");
      return;
    }
    if (!user) {
      navigate("/sign-in", { state: { from: "/" } });
      return;
    }
    setLoading(true);
    try {
      const sb = getSupabase()!;
      const { data, error } = await sb.functions.invoke("stripe-checkout", { body: {} });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No checkout URL returned");
      window.location.assign(url);
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message ?? "Couldn't start checkout.");
      setLoading(false);
    }
  };

  return (
    <Button variant="gold" onClick={start} disabled={loading} {...props}>
      <Sparkles className="h-4 w-4" />
      {loading ? "Redirecting…" : children}
    </Button>
  );
}
