/**
 * Live SOLD-side rates — per-city median $/sf computed from real recorded
 * sales (public deed records where cities publish them; ATTOM slots into the
 * same store later). This is the sell-side twin of liveCosts.
 */
export interface LiveSaleRate {
  ppsf: number;
  samples: number;
}

const rates = new Map<string, LiveSaleRate>();

export function setLiveSaleRates(entries: { city: string; ppsf: number; samples: number }[]) {
  rates.clear();
  for (const e of entries) rates.set(e.city, { ppsf: e.ppsf, samples: e.samples });
}

export function getLiveSaleRate(city: string): LiveSaleRate | null {
  return rates.get(city) ?? null;
}
