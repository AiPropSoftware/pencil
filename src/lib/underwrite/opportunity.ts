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
import { METRO_CENTERS, type ProductType } from "@/data/developments";
import { getLiveBuildCost } from "./liveCosts";

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
  // Priority: (1) median declared build cost from that city's REAL permits,
  // (2) curated regional baseline, (3) derived from sale $/sqft, bounded.
  const live = getLiveBuildCost(city);
  const derived = Math.round(Math.min(400, Math.max(180, (METRO_CENTERS[city]?.ppsf ?? 350) * 0.5)));
  const base = live?.ppsf ?? BUILD_SFH_PPSF[city] ?? derived;
  return Math.round(base * (TYPE_BUILD_FACTOR[type] ?? 1));
}

export interface OpportunityInput {
  city: string;
  type: ProductType;
  buildableSqft: number;
  areaPpsf: number;        // sale $/sqft for finished product in the area
  landPrice?: number;      // known list/ask price, if any
  targetMargin?: number;
  buildPpsfOverride?: number; // let the user override the regional estimate
  /** User's construction-financing estimate ($) — replaces the modeled 6% of build. */
  finCostOverride?: number;
  /** User's closing-costs estimate ($) — pulled out of the soft allowance as its own line. */
  closingCostOverride?: number;
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

/**
 * Margins above this are almost always an input problem (area $/sf that
 * doesn't fit the parcel), not a real deal — flag them, don't celebrate them.
 */
export const PLAUSIBLE_MARGIN_CAP = 0.6;

export function scoreOpportunity(i: OpportunityInput): Opportunity {
  const bppsf = i.buildPpsfOverride ?? buildPpsf(i.city, i.type);
  const buildCost = bppsf * i.buildableSqft;
  const arv = Math.round(i.areaPpsf * i.buildableSqft);
  const financing = i.finCostOverride ?? buildCost * FINANCING_PCT;
  // With a user closing estimate, closing leaves the soft allowance and
  // becomes its own explicit line (remaining soft: permits/arch/eng/contingency).
  const softPct = i.closingCostOverride != null ? 0.06 : SOFT_PCT;
  const closing = i.closingCostOverride ?? 0;
  const sellingCosts = arv * SELLING_PCT;
  const targetMargin = i.targetMargin ?? targetMarginFor(i.type);

  // Max Allowable Offer — invert margin = (arv - selling - allIn) / allIn ≥ t.
  // Approximate soft costs on build only (keeps the inversion linear).
  const fixedCosts = buildCost + buildCost * softPct + financing + closing;
  const netSale = arv - sellingCosts;
  const maxLandPrice = Math.max(0, netSale / (1 + targetMargin) - fixedCosts);

  const out: Opportunity = {
    buildPpsf: bppsf,
    buildCost: Math.round(buildCost),
    arv,
    softCosts: Math.round((buildCost + (i.landPrice ?? maxLandPrice)) * softPct + closing),
    financing: Math.round(financing),
    sellingCosts: Math.round(sellingCosts),
    targetMargin,
    maxLandPrice: Math.round(maxLandPrice),
  };

  if (i.landPrice != null && i.landPrice > 0) {
    const soft = (i.landPrice + buildCost) * softPct + closing;
    const allIn = i.landPrice + buildCost + soft + financing;
    const profit = arv - sellingCosts - allIn;
    const margin = allIn > 0 ? profit / allIn : 0;
    out.softCosts = Math.round(soft);
    out.atPrice = {
      allIn: Math.round(allIn),
      profit: Math.round(profit),
      margin,
      // A "deal" must beat target AND stay inside the plausible band.
      isDeal: margin >= targetMargin && margin <= PLAUSIBLE_MARGIN_CAP,
    };
  }

  return out;
}
