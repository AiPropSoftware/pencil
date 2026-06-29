export interface PermitRecord {
  id: string;
  address: string;
  lat: number;
  lng: number;
  type: "new_construction" | "addition" | "remodel" | "other";
  status: "issued" | "in_review" | "finaled" | "expired";
  valuation: number | null;
  contractor: string | null;
  issuedDate: string;       // ISO
  description: string;
  jurisdiction: string;
}

export interface PermitsQuery {
  center?: { lat: number; lng: number };
  radiusMi?: number;
  polygon?: GeoJSON.Polygon;
  monthsBack?: number;
  newConstructionOnly?: boolean;
}

export interface PermitsProvider {
  readonly name: string;
  search(q: PermitsQuery): Promise<PermitRecord[]>;
}
