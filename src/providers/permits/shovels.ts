import { getSupabase } from "@/integrations/supabase/client";
import type { PermitRecord, PermitsProvider, PermitsQuery } from "./types";

export const shovelsProvider: PermitsProvider = {
  name: "shovels",
  async search(q: PermitsQuery): Promise<PermitRecord[]> {
    const sb = getSupabase();
    if (!sb) return demoPermits(q);
    const { data, error } = await sb.functions.invoke("permits-search", {
      body: { provider: "shovels", query: q },
    });
    if (error) {
      console.warn("shovels edge function unavailable, returning demo permits", error);
      return demoPermits(q);
    }
    return (data as { permits?: PermitRecord[] })?.permits ?? [];
  },
};

export function demoPermits(q: PermitsQuery): PermitRecord[] {
  const center = q.center ?? { lat: 30.2672, lng: -97.7431 };
  const contractors = ["Lariat Homes", "Cedar & Pine LLC", "Brick Stone Build", "Halo Construction", "Foundry Custom Homes"];
  return Array.from({ length: 14 }, (_, i) => ({
    id: `permit-${i}`,
    address: `${100 + i * 37} Sample Ln`,
    lat: center.lat + Math.sin(i * 0.71) * 0.04,
    lng: center.lng + Math.cos(i * 0.71) * 0.06,
    type: "new_construction",
    status: i % 4 === 0 ? "finaled" : "issued",
    valuation: 420_000 + i * 18_500,
    contractor: contractors[i % contractors.length],
    issuedDate: new Date(2026, 5 - (i % 6), 1 + i).toISOString().slice(0, 10),
    description: i % 3 === 0 ? "Fourplex new construction" : "Single family new construction",
    jurisdiction: "Travis County",
  }));
}
