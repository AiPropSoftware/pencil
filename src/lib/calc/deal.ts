/**
 * Pencil — Deal Analyzer math.
 *
 * Mirrors the Developer Launch underwriting model: ground-up small multifamily /
 * infill development with optional refi (BRRRR-style) and optional capital partner.
 * All amounts are USD; all rates are expressed as decimals (0.075 = 7.5%).
 */

export interface DealInputs {
  // Project costs
  address?: string;
  landCost: number;
  costPerSqft: number;
  totalSqft: number;
  closingCostsPct: number;     // % of (land + hard cost)
  lenderFeesPct: number;       // % of construction loan
  constructionRate: number;    // annual rate, decimal
  monthsToBuild: number;
  ltcPct: number;              // loan-to-cost on construction loan, decimal
  arv: number;                 // after-repair / completed value (sale price)

  // Disposition (build-to-sell) — cost of actually selling the finished home
  applySellingCosts: boolean;  // true in build-to-sell mode
  salesCommissionPct: number;  // realtor commission on the sale price, decimal
  saleClosingPct: number;      // seller-side closing on the sale price, decimal

  // Refi
  refiEnabled: boolean;
  refiLtvPct: number;          // decimal
  refiClosingPct: number;      // % of refi loan
  refiRate: number;            // annual decimal
  refiTermYears: number;
  amortYears: number;

  // Partner
  partnerEnabled: boolean;
  sponsorEquityPct: number;    // sponsor's share of remaining equity, decimal

  // Rental operating (monthly except where noted)
  monthlyRent: number;
  vacancyPct: number;          // decimal
  taxesMo: number;
  insuranceMo: number;
  maintenanceMo: number;
  managementPct: number;       // % of EGI, decimal
  otherMo: number;
}

export const defaultDeal: DealInputs = {
  address: "",
  landCost: 250_000,
  costPerSqft: 220,
  totalSqft: 3200,
  closingCostsPct: 0.02,
  lenderFeesPct: 0.02,
  constructionRate: 0.115, // 2026 ground-up hard-money average (published range 11–15%)
  monthsToBuild: 10,
  ltcPct: 0.80,
  arv: 1_250_000,

  applySellingCosts: false,
  salesCommissionPct: 0.057, // avg total commission, Feb-2026 agent survey
  saleClosingPct: 0.01,

  refiEnabled: true,
  refiLtvPct: 0.75,
  refiClosingPct: 0.02,
  refiRate: 0.0725,
  refiTermYears: 30,
  amortYears: 30,

  partnerEnabled: false,
  sponsorEquityPct: 0.30,

  monthlyRent: 8400,
  vacancyPct: 0.05,
  taxesMo: 850,
  insuranceMo: 320,
  maintenanceMo: 200,
  managementPct: 0.08,
  otherMo: 50,
};

export interface DealResults {
  // Project / construction
  hardConstruction: number;
  closingCosts: number;
  totalDevCostBeforeFinancing: number;
  constructionLoan: number;
  lenderFees: number;
  monthlyCarry: number;
  totalCarry: number;
  allInCost: number;
  cashRequired: number;
  sellingCosts: number;           // commission + sale closing (sell mode only)
  netSaleProceeds: number;        // ARV - sellingCosts
  projectedProfit: number;        // net proceeds - all-in
  profitMargin: number;           // profit / all-in

  // Refi (zeros when disabled)
  refiLoan: number;
  refiClosing: number;
  netCashAtRefi: number;          // refi loan net of closing
  originalCashBack: number;       // min(cashRequired, netCashAtRefi)
  equityCreated: number;          // ARV - refiLoan
  newPI: number;                  // monthly P&I
  cashLeftInDeal: number;         // max(0, cashRequired - netCashAtRefi)

  // Rental operating
  grossRent: number;
  vacancyLoss: number;
  egi: number;                    // effective gross income
  opex: number;
  noi: number;
  debtService: number;            // annual P&I
  cashFlow: number;               // annual after debt service
  capRate: number;                // NOI / ARV
  cashOnCash: number;             // cashFlow / cashLeftInDeal (or cashRequired if no refi)
  dscr: number;                   // NOI / debt service

  // Partner economics (optional)
  sponsorProfitShare: number;
  investorProfitShare: number;
}

const ZEROS = {
  refiLoan: 0, refiClosing: 0, netCashAtRefi: 0, originalCashBack: 0,
  equityCreated: 0, newPI: 0, cashLeftInDeal: 0,
};

/** Mortgage payment given loan, annual rate (decimal), term in years. */
export function mortgagePayment(loan: number, annualRate: number, years: number): number {
  if (loan <= 0 || years <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return loan / n;
  return (loan * r) / (1 - Math.pow(1 + r, -n));
}

/** Simple-interest average-balance approximation of construction carry. */
function constructionCarry(loan: number, rate: number, months: number): number {
  // Assume linear draw-down → average outstanding balance ≈ loan / 2
  const monthlyInterestOnAvg = (loan / 2) * (rate / 12);
  return monthlyInterestOnAvg * months;
}

export function calcDeal(d: DealInputs): DealResults {
  const hardConstruction = d.costPerSqft * d.totalSqft;
  const projectBase = d.landCost + hardConstruction;
  const closingCosts = projectBase * d.closingCostsPct;
  const totalDevCostBeforeFinancing = projectBase + closingCosts;

  const constructionLoan = totalDevCostBeforeFinancing * d.ltcPct;
  const lenderFees = constructionLoan * d.lenderFeesPct;
  const totalCarry = constructionCarry(constructionLoan, d.constructionRate, d.monthsToBuild);
  const monthlyCarry = d.monthsToBuild > 0 ? totalCarry / d.monthsToBuild : 0;

  const allInCost = totalDevCostBeforeFinancing + lenderFees + totalCarry;
  const cashRequired = allInCost - constructionLoan;
  const sellingCosts = d.applySellingCosts ? d.arv * (d.salesCommissionPct + d.saleClosingPct) : 0;
  const netSaleProceeds = d.arv - sellingCosts;
  const projectedProfit = netSaleProceeds - allInCost;
  const profitMargin = allInCost > 0 ? projectedProfit / allInCost : 0;

  let refi = { ...ZEROS };
  if (d.refiEnabled) {
    const refiLoan = d.arv * d.refiLtvPct;
    const refiClosing = refiLoan * d.refiClosingPct;
    const netCashAtRefi = refiLoan - refiClosing - constructionLoan; // pay off construction loan
    const originalCashBack = Math.min(Math.max(0, netCashAtRefi), cashRequired);
    const equityCreated = d.arv - refiLoan;
    const newPI = mortgagePayment(refiLoan, d.refiRate, d.amortYears);
    const cashLeftInDeal = Math.max(0, cashRequired - Math.max(0, netCashAtRefi));
    refi = { refiLoan, refiClosing, netCashAtRefi, originalCashBack, equityCreated, newPI, cashLeftInDeal };
  }

  // Rental operating (annualized)
  const grossRent = d.monthlyRent * 12;
  const vacancyLoss = grossRent * d.vacancyPct;
  const egi = grossRent - vacancyLoss;
  const managementCost = egi * d.managementPct;
  const opex = (d.taxesMo + d.insuranceMo + d.maintenanceMo + d.otherMo) * 12 + managementCost;
  const noi = egi - opex;
  const debtService = refi.newPI * 12;
  const cashFlow = noi - debtService;

  const capRate = d.arv > 0 ? noi / d.arv : 0;
  const cashBasisForCoC = d.refiEnabled ? refi.cashLeftInDeal || 1 : cashRequired || 1;
  const cashOnCash = cashFlow / cashBasisForCoC;
  const dscr = debtService > 0 ? noi / debtService : Infinity;

  let sponsorProfitShare = 0;
  let investorProfitShare = 0;
  if (d.partnerEnabled) {
    sponsorProfitShare = projectedProfit * d.sponsorEquityPct;
    investorProfitShare = projectedProfit - sponsorProfitShare;
  }

  return {
    hardConstruction,
    closingCosts,
    totalDevCostBeforeFinancing,
    constructionLoan,
    lenderFees,
    monthlyCarry,
    totalCarry,
    allInCost,
    cashRequired,
    sellingCosts,
    netSaleProceeds,
    projectedProfit,
    profitMargin,
    ...refi,
    grossRent,
    vacancyLoss,
    egi,
    opex,
    noi,
    debtService,
    cashFlow,
    capRate,
    cashOnCash,
    dscr,
    sponsorProfitShare,
    investorProfitShare,
  };
}
