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
  financing: number;       // real derivation: LTC loan × rate × drawn balance + points
  sellingCosts: number;    // realtor commission + seller closing
  /** % of ARV deducted on sale (commission + closing) — for display. */
  sellingPct: number;
  /** Build duration assumption behind the financing figure — for display. */
  finMonths: number;
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

const SOFT_PCT = 0.08;      // % of (land + build): permits, arch/eng, contingency

// ── 2026 market constants (update as the market moves) ─────────────────────
/** Avg total realtor commission — Clever Feb-2026 agent survey: 5.70%. */
const REALTOR_COMMISSION = 0.057;
/** Seller-side closing beyond commission (title, transfer, escrow). */
const SALE_CLOSING = 0.01;
const SELLING_PCT = REALTOR_COMMISSION + SALE_CLOSING;
/** Ground-up hard money, 2026 published range 11–15% interest-only — midpoint. */
export const HARD_MONEY_RATE = 0.115;
export const HARD_MONEY_POINTS = 0.02;
const FIN_LTC = 0.85;       // typical max loan-to-cost
const AVG_DRAWN = 0.55;     // construction draws → average outstanding balance

/** Typical ground-up build duration by product (months). */
export function buildMonthsFor(type: ProductType): number {
  switch (type) {
    case "SFH":
    case "Infill": return 9;
    case "Duplex": return 10;
    case "Townhomes": return 11;
    case "Fourplex": return 12;
    default: return 14;
  }
}

/**
 * Margins above this are almost always an input problem (area $/sf that
 * doesn't fit the parcel), not a real deal — flag them, don't celebrate them.
 */
export const PLAUSIBLE_MARGIN_CAP = 0.6;

export function scoreOpportunity(i: OpportunityInput): Opportunity {
  const bppsf = i.buildPpsfOverride ?? buildPpsf(i.city, i.type);
  const buildCost = bppsf * i.buildableSqft;
  const arv = Math.round(i.areaPpsf * i.buildableSqft);
  // With a user closing estimate, closing leaves the soft allowance and
  // becomes its own explicit line (remaining soft: permits/arch/eng/contingency).
  const softPct = i.closingCostOverride != null ? 0.06 : SOFT_PCT;
  const closing = i.closingCostOverride ?? 0;
  const months = buildMonthsFor(i.type);
  // Financing as a real loan: 85% LTC on total project cost, interest-only at
  // the current hard-money rate on the average drawn balance, plus points.
  // k folds it into a multiplier on cost so the max-land inversion stays exact.
  const k = i.finCostOverride != null
    ? 0
    : FIN_LTC * (HARD_MONEY_RATE * (months / 12) * AVG_DRAWN + HARD_MONEY_POINTS);
  const sellingCosts = arv * SELLING_PCT;
  const netSale = arv - sellingCosts;
  const targetMargin = i.targetMargin ?? targetMarginFor(i.type);

  // Max Allowable Offer — solve margin = (netSale − allIn)/allIn ≥ t for land:
  // allIn = (L+B)(1+soft)(1+k) + closing(1+k) + finOverride
  const maxLandPrice = Math.max(
    0,
    (netSale / (1 + targetMargin) - closing * (1 + k) - (i.finCostOverride ?? 0)) / ((1 + softPct) * (1 + k)) - buildCost,
  );

  const price = i.landPrice != null && i.landPrice > 0 ? i.landPrice : maxLandPrice;
  const soft = (price + buildCost) * softPct;
  const preFinancing = price + buildCost + soft + closing;
  const financing = i.finCostOverride ?? preFinancing * k;

  const out: Opportunity = {
    buildPpsf: bppsf,
    buildCost: Math.round(buildCost),
    arv,
    softCosts: Math.round(soft + closing),
    financing: Math.round(financing),
    sellingCosts: Math.round(sellingCosts),
    sellingPct: SELLING_PCT,
    finMonths: months,
    targetMargin,
    maxLandPrice: Math.round(maxLandPrice),
  };

  if (i.landPrice != null && i.landPrice > 0) {
    const allIn = preFinancing + financing;
    const profit = netSale - allIn;
    const margin = allIn > 0 ? profit / allIn : 0;
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
