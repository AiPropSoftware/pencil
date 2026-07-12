/**
 * Client side of the MLS feed. Calls the listings-mls edge function (Bridge/
 * Trestle RESO). Until BRIDGE_TOKEN + BRIDGE_DATASET are set in Supabase
 * secrets it reports configured:false and the map keeps demo listings —
 * the moment credentials exist, real listings (with real photos) flow in
 * with zero further code.
 */
import { getSupabase } from "@/integrations/supabase/client";
import { buildableFor, LISTING_KINDS, type Listing, type ListingKind } from "@/data/listings";

export interface MlsStatus {
  configured: boolean;
  count: number;
  error?: string;
}

interface RawMls {
  id: string; kind: string; address: string; city: string; state: string;
  lat: number; lng: number; listPrice: number; lotSqft: number; buildingSqft: number;
  beds: number | null; baths: number | null; yearBuilt: number | null;
  daysOnMarket: number; photo: string | null;
}

export async function fetchMlsListings(): Promise<{ listings: Listing[]; status: MlsStatus }> {
  const sb = getSupabase();
  if (!sb) return { listings: [], status: { configured: false, count: 0, error: "supabase not configured" } };
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) return { listings: [], status: { configured: false, count: 0, error: "sign-in required" } };

  const { data, error } = await sb.functions.invoke("listings-mls", { body: { top: 300 } });
  if (error) return { listings: [], status: { configured: false, count: 0, error: error.message } };

  const configured = !!(data as { configured?: boolean })?.configured;
  const raw = ((data as { listings?: RawMls[] })?.listings ?? []).filter(
    (r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.listPrice > 0,
  );

  const listings: Listing[] = raw.map((r) => {
    const kind = (LISTING_KINDS.includes(r.kind as ListingKind) ? r.kind : "SFH resale") as ListingKind;
    const built = buildableFor(kind, r.lotSqft || 5000);
    const listedDate = new Date(Date.now() - (r.daysOnMarket ?? 0) * 86_400_000).toISOString().slice(0, 10);
    return {
      id: r.id,
      kind,
      address: r.address,
      city: r.city,
      state: r.state,
      lat: r.lat,
      lng: r.lng,
      listPrice: r.listPrice,
      lotSqft: r.lotSqft || 0,
      buildingSqft: r.buildingSqft || 0,
      beds: r.beds,
      baths: r.baths,
      yearBuilt: r.yearBuilt,
      daysOnMarket: r.daysOnMarket ?? 0,
      productTypeIfBuilt: built.type,
      buildableSqft: built.sqft,
      priceHistory: [{ date: listedDate, price: r.listPrice, event: "Listed" }],
      photo: r.photo ?? undefined,
    };
  });

  return { listings, status: { configured, count: listings.length } };
}
