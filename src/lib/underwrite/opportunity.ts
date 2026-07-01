/**
 * The "X-ray" deal engine.
 *
 * Answers the developer's core question on any parcel/listing:
 *   - What can I build it for?   (regional build $/sqft model)
 *   - What will it sell for?      (area sale $/sqft × buildable sqft)
 *   - Is it a deal?               (margin vs target)
 *   - What's the most I can pay?  (Max Allowable Offer for the land)
 *
 * Build costs are a curated regional baseline (tunable, and replaceable with
 * real GC bids later). Everything is transparent so the user can override.
 */
import type { ProductType } from "@/data/developments";

/** Baseline single-family build cost ($/sqft) by metro. Tune with real bids. */
const BUILD_SFH_PPSF: Record<string, number> = {
  Miami: 375, Austin: 235, Dallas: 215, Houston: 205, Phoenix: 220, Denver: 260,
  Nashville: 235, Atlanta: 210, Tampa: 215, Charlotte: 210, Raleigh: 215,
  Seattle: 320, Portland: 285, Columbus: 195, "Salt Lake City": 250,
  Boise: 225, "Las Vegas": 205,
};

/** Multi-unit builds cost less per sqft than detached SFH (shared systems). */
const TYPE_BUILD_FACTOR: Record<ProductType, number> = {
  SFH: 1.0, Infill: 1.0, Townhomes: 0.9, Duplex: 0.9, Fourplex: 0.82, "Small multi": 0.8,
};

/** Target profit margin (on cost) developers underwrite to, by product type. */
export function targetMarginFor(type: ProductType): number {
  return type === "SFH" || type === "Infill" ? 0.25 : 0.2; // 25% SFH, 20% multi
}

export function buildPpsf(city: string, type: ProductType): number {
  const base = BUILD_SFH_PPSF[city] ?? 220;
  return Math.round(base * (TYPE_BUILD_FACTOR[type] ?? 1));
}

export interface OpportunityInput {
  city: string;
  type: ProductType;
  buildableSqft: number;
  areaPpsf: number;        // sale $/sqft for finished product in the area
  landPrice?: number;      // known list/ask price, if any
  targetMargin?: number;
}

export interface Opportunity {
  buildPpsf: number;
  buildCost: number;
  arv: number;
  softCosts: number;       // closing, permits, arch/eng, contingency
  financing: number;       // fees + carry (rough)
  sellingCosts: number;    // commission + sale closing
  targetMargin: number;
  /** Most you can pay for the land and still hit the target margin. */
  maxLandPrice: number;
  /** Present only when a landPrice was supplied. */
  atPrice?: {
    allIn: number;
    profit: number;
    margin: number;
    isDeal: boolean;
  };
}

const SOFT_PCT = 0.08;      // % of (land + build)
const FINANCING_PCT = 0.06; // % of build (fees + carry proxy)
const SELLING_PCT = 0.06;   // commission + sale closing

export function scoreOpportunity(i: OpportunityInput): Opportunity {
  const bppsf = buildPpsf(i.city, i.type);
  const buildCost = bppsf * i.buildableSqft;
  const arv = Math.round(i.areaPpsf * i.buildableSqft);
  const financing = buildCost * FINANCING_PCT;
  const sellingCosts = arv * SELLING_PCT;
  const targetMargin = i.targetMargin ?? targetMarginFor(i.type);

  // Max Allowable Offer — invert margin = (arv - selling - allIn) / allIn ≥ t.
  // Approximate soft costs on build only (keeps the inversion linear).
  const fixedCosts = buildCost + buildCost * SOFT_PCT + financing;
  const netSale = arv - sellingCosts;
  const maxLandPrice = Math.max(0, netSale / (1 + targetMargin) - fixedCosts);

  const out: Opportunity = {
    buildPpsf: bppsf,
    buildCost: Math.round(buildCost),
    arv,
    softCosts: Math.round((buildCost + (i.landPrice ?? maxLandPrice)) * SOFT_PCT),
    financing: Math.round(financing),
    sellingCosts: Math.round(sellingCosts),
    targetMargin,
    maxLandPrice: Math.round(maxLandPrice),
  };

  if (i.landPrice != null && i.landPrice > 0) {
    const soft = (i.landPrice + buildCost) * SOFT_PCT;
    const allIn = i.landPrice + buildCost + soft + financing;
    const profit = arv - sellingCosts - allIn;
    const margin = allIn > 0 ? profit / allIn : 0;
    out.softCosts = Math.round(soft);
    out.atPrice = { allIn: Math.round(allIn), profit: Math.round(profit), margin, isDeal: margin >= targetMargin };
  }

  return out;
}
