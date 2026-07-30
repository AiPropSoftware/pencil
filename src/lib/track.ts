/**
 * Usage tracking — one row per meaningful action in `usage_events`, so the
 * team can see how much and how long each beta user actually uses Pencil.
 * Fire-and-forget: tracking must never slow down or break the app, and it
 * silently does nothing when the user isn't signed in.
 */
import { getSupabase } from "@/integrations/supabase/client";

const firedThisSession = new Set<string>();

export function track(event: string, meta: Record<string, unknown> = {}, oncePerSession = false): void {
  try {
    const sb = getSupabase();
    if (!sb) return;
    if (oncePerSession) {
      const key = `pencil-evt-${event}`;
      if (firedThisSession.has(key) || sessionStorage.getItem(key)) return;
      firedThisSession.add(key);
      try { sessionStorage.setItem(key, "1"); } catch { /* private mode */ }
    }
    void sb.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      void sb.from("usage_events").insert({ user_id: uid, event, meta }).then(() => {});
    });
  } catch {
    // Never let analytics take down the product.
  }
}
