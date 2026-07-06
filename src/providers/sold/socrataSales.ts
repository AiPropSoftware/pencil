/**
 * Real recorded sales from open deed data — free, no key. NYC publishes its
 * Rolling Calendar Sales (price + gross sqft per transfer); more cities/
 * counties join this roster the same way permits did. ATTOM later replaces
 * the gaps nationally through the same LiveSaleRate store.
 */
export interface SoldSource {
  city: string;
  url: string;
  priceKey: string;
  sqftKey: string;
  limit?: number;
}

export const SOLD_SOURCES: SoldSource[] = [
  {
    city: "New York",
    url: "https://data.cityofnewyork.us/resource/w2pb-icbu.json",
    priceKey: "sale_price",
    sqftKey: "gross_square_feet",
    limit: 5000,
  },
  {
    // Cook County Assessor — Parcel Sales (recorded transfers). Field names
    // self-verify via the console diagnostic; <20 usable samples = no effect.
    city: "Chicago",
    url: "https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json",
    priceKey: "sale_price",
    sqftKey: "char_bldg_sf",
    limit: 5000,
  },
];

export interface SoldRateResult {
  city: string;
  ppsf: number | null;
  samples: number;
  error?: string;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

async function fetchOne(src: SoldSource): Promise<SoldRateResult> {
  const base = new URLSearchParams({ $limit: String(src.limit ?? 4000) });
  const ordered = new URLSearchParams(base);
  ordered.set("$order", ":id DESC");
  let url = `${src.url}?${ordered.toString()}`;
  let rows: Record<string, unknown>[] = [];
  try {
    let res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 400) {
      url = `${src.url}?${base.toString()}`;
      res = await fetch(url, { headers: { Accept: "application/json" } });
    }
    if (!res.ok) return { city: src.city, ppsf: null, samples: 0, error: `HTTP ${res.status}` };
    const data = await res.json();
    if (!Array.isArray(data)) return { city: src.city, ppsf: null, samples: 0, error: "unexpected response" };
    rows = data as Record<string, unknown>[];
  } catch (e) {
    return { city: src.city, ppsf: null, samples: 0, error: (e as Error).message };
  }

  const samples: number[] = [];
  for (const r of rows) {
    const price = num(r[src.priceKey]);
    const sqft = num(r[src.sqftKey]);
    if (!Number.isFinite(price) || !Number.isFinite(sqft)) continue;
    // Arm's-length residential sanity: real price, real building, plausible $/sf.
    if (price < 50_000 || sqft < 300) continue;
    const ppsf = price / sqft;
    if (ppsf < 40 || ppsf > 4000) continue;
    samples.push(ppsf);
  }
  samples.sort((a, b) => a - b);
  const median = samples.length >= 20 ? Math.round(samples[Math.floor(samples.length / 2)]) : null;
  return { city: src.city, ppsf: median, samples: samples.length, error: median ? undefined : `only ${samples.length} usable sales` };
}

export async function fetchSoldRates(): Promise<SoldRateResult[]> {
  const settled = await Promise.allSettled(SOLD_SOURCES.map(fetchOne));
  return settled.map((r, i) =>
    r.status === "fulfilled" ? r.value : { city: SOLD_SOURCES[i].city, ppsf: null, samples: 0, error: String(r.reason) },
  );
}
