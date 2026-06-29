import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/integrations/supabase/types";
import { UpgradeButton } from "@/components/UpgradeButton";

interface Props {
  children: React.ReactNode;
  /** Minimum required role. Default 'free' (just signed in). */
  requireRole?: Role;
}

const RANK: Record<Role, number> = { free: 0, pro: 1, admin: 2 };

export function RequireAuth({ children, requireRole = "free" }: Props) {
  const { user, role, loading, configured } = useAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <div className="container py-16 max-w-xl">
        <h2 className="font-display text-3xl">Connect Supabase to continue</h2>
        <p className="mt-3 text-muted-foreground">
          This page requires authentication and data storage. Set{" "}
          <code className="px-1.5 py-0.5 rounded bg-secondary text-foreground">
            VITE_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="px-1.5 py-0.5 rounded bg-secondary text-foreground">
            VITE_SUPABASE_ANON_KEY
          </code>{" "}
          in your environment, then reload.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="container py-20 text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  }

  const userRank = RANK[role ?? "free"];
  if (userRank < RANK[requireRole]) {
    return (
      <div className="container py-16 max-w-xl">
        <div className="gold-rule" />
        <h2 className="mt-3 font-display text-3xl">Upgrade to access</h2>
        <p className="mt-3 text-muted-foreground">
          This module is included with the Pro plan — $149/month, cancel
          anytime. One avoided bad deal pays for it for the next decade.
        </p>
        <div className="mt-6">
          <UpgradeButton size="lg">Start Pro · $149/mo</UpgradeButton>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
