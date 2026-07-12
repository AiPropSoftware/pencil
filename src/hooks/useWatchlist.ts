import * as React from "react";

const KEY = "pencil:watchlist";

/**
 * Watchlist — heart any property and it persists across visits (localStorage;
 * Supabase sync is a straightforward upgrade later). The core retention loop:
 * users come back to see what changed on the deals they're tracking.
 */
export function useWatchlist() {
  const [ids, setIds] = React.useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    } catch {
      return new Set<string>();
    }
  });

  const toggle = React.useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {
        /* storage full/blocked — watchlist just won't persist */
      }
      return next;
    });
  }, []);

  return { ids, toggle };
}
