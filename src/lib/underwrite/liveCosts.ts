/**
 * Live build-cost store — per-city median declared build $/sf computed from
 * real permits (valuation ÷ sqft). Set once when the live feeds load; the
 * underwrite engine consults it before falling back to the curated baseline.
 */
export interface LiveBuildCost {
  ppsf: number;
  samples: number;
}

const costs = new Map<string, LiveBuildCost>();

export function setLiveBuildCosts(entries: Record<string, LiveBuildCost>) {
  costs.clear();
  for (const [city, v] of Object.entries(entries)) costs.set(city, v);
}

export function getLiveBuildCost(city: string): LiveBuildCost | null {
  return costs.get(city) ?? null;
}
