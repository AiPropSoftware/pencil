/** Provider-agnostic comp record returned by every compsProvider implementation. */
export interface CompRecord {
  id: string;
  address: string;
  lat: number;
  lng: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  soldPrice: number;
  soldDate: string;        // ISO
  listPrice: number | null;
  daysOnMarket: number | null;
  pricePerSqft: number | null;
  source: string;          // "attom" | "estated" | ...
}

export interface CompsQuery {
  /** Search center; required unless polygon is provided */
  center?: { lat: number; lng: number };
  /** Search radius in miles (if center) */
  radiusMi?: number;
  /** GeoJSON Polygon (if drawing) */
  polygon?: GeoJSON.Polygon;
  /** Only properties sold in the last N months */
  monthsBack?: number;
  /** Filter to new-construction (year_built >= soldYear - 1) */
  newConstructionOnly?: boolean;
  minSqft?: number;
  maxSqft?: number;
  minBeds?: number;
}

export interface CompsProvider {
  readonly name: string;
  search(q: CompsQuery): Promise<CompRecord[]>;
}
