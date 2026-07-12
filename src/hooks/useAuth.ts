import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import type { Role } from "@/integrations/supabase/types";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: Role | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [session, setSession] = React.useState<Session | null>(null);
  const [role, setRole] = React.useState<Role | null>(null);
  const [loading, setLoading] = React.useState(true);
  const configured = isSupabaseConfigured();

  React.useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }

    // 1. Subscribe FIRST so we don't miss the initial SIGNED_IN event.
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setRole(null);
        return;
      }
      // Defer role lookup to avoid deadlocking the auth callback.
      setTimeout(async () => {
        const { data } = await sb
          .from("user_roles")
          .select("role")
          .eq("user_id", s.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setRole((data?.role as Role) ?? "free");
      }, 0);
    });

    // 2. Then read existing session.
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = React.useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
  }, []);

  return {
    user: session?.user ?? null,
    session,
    role,
    loading,
    configured,
    signOut,
  };
}
