/**
 * Hard-money & construction lender directory — the funding side of the stack.
 *
 * Curated from each lender's own published marketing pages (loan products,
 * advertised ranges, state footprints). These are pointers, not offers:
 * coverage and terms shift constantly, so every entry links straight to the
 * lender and the UI carries a verify-with-lender disclaimer. No affiliation.
 */

export interface Lender {
  name: string;
  url: string;
  /** What they're best known for, shortest form. */
  focus: string;
  /** Advertised loan-size range (approximate). */
  loans: string;
  /** "nationwide" = most states (their site gates exact eligibility). */
  states: "nationwide" | string[];
}

export const HARD_MONEY_LENDERS: Lender[] = [
  {
    name: "Kiavi",
    url: "https://www.kiavi.com",
    focus: "Fix & flip · New construction",
    loans: "$100k – $3M",
    states: ["AZ", "CA", "CO", "CT", "DC", "FL", "GA", "IL", "IN", "KS", "KY", "MA", "MD", "MI", "MN", "MO", "NC", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "SC", "TN", "TX", "UT", "VA", "WA", "WI", "WV"],
  },
  {
    name: "Lima One Capital",
    url: "https://www.limaone.com",
    focus: "Ground-up construction · Fix & flip · Rental",
    loans: "$75k – $3M+",
    states: "nationwide",
  },
  {
    name: "RCN Capital",
    url: "https://www.rcncapital.com",
    focus: "Bridge · New construction · Long-term rental",
    loans: "$50k – $10M",
    states: "nationwide",
  },
  {
    name: "Anchor Loans",
    url: "https://www.anchorloans.com",
    focus: "Ground-up · Fix & flip (high volume)",
    loans: "$100k – $10M",
    states: "nationwide",
  },
  {
    name: "Temple View Capital",
    url: "https://templeviewcap.com",
    focus: "Bridge · New construction · DSCR",
    loans: "$100k – $5M",
    states: "nationwide",
  },
  {
    name: "CoreVest Finance",
    url: "https://www.corevestfinance.com",
    focus: "Build-to-rent · Bridge · Portfolio",
    loans: "$150k – $50M",
    states: "nationwide",
  },
  {
    name: "Easy Street Capital",
    url: "https://www.easystreetcap.com",
    focus: "EasyBuild ground-up · Bridge",
    loans: "$75k – $5M",
    states: ["AL", "AR", "AZ", "CO", "CT", "DC", "FL", "GA", "IA", "IL", "IN", "KS", "KY", "LA", "MA", "MD", "MI", "MO", "MS", "NC", "NH", "NJ", "NM", "OH", "OK", "PA", "SC", "TN", "TX", "VA", "WA", "WI", "WV", "WY"],
  },
  {
    name: "New Silver",
    url: "https://newsilver.com",
    focus: "Ground-up · Fix & flip (instant online term sheet)",
    loans: "$100k – $5M",
    states: "nationwide",
  },
  {
    name: "Groundfloor",
    url: "https://www.groundfloor.com",
    focus: "Fix & flip · New construction (crowdfunded)",
    loans: "$75k – $1.5M",
    states: ["AL", "AZ", "CA", "CO", "CT", "DC", "FL", "GA", "IL", "IN", "KY", "MA", "MD", "MI", "MN", "MO", "NC", "NJ", "NV", "NY", "OH", "OK", "OR", "PA", "SC", "TN", "TX", "UT", "VA", "WA", "WI"],
  },
  {
    name: "Builders Capital",
    url: "https://builderscapital.com",
    focus: "Construction-only lender (spec, BTR, land dev)",
    loans: "$250k – $10M",
    states: ["AL", "AZ", "CO", "FL", "GA", "ID", "NC", "NV", "OR", "SC", "TN", "TX", "UT", "WA"],
  },
  {
    name: "Renovo Financial",
    url: "https://renovofinancial.com",
    focus: "Ground-up · Fix & flip (local teams)",
    loans: "$100k – $3M",
    states: ["AZ", "CO", "FL", "GA", "IL", "IN", "KY", "MD", "MI", "MN", "MO", "NC", "OH", "PA", "TN", "TX", "VA", "WA", "WI"],
  },
  {
    name: "Longhorn Investments",
    url: "https://www.longhorninvestments.com",
    focus: "Fix & flip · New construction (Sun Belt)",
    loans: "$75k – $2M",
    states: ["AL", "GA", "IN", "MO", "NC", "TN", "TX"],
  },
  {
    name: "Upright (Fund That Flip)",
    url: "https://www.upright.us",
    focus: "Fix & flip · New construction (Midwest/Northeast)",
    loans: "$100k – $2M",
    states: ["CT", "FL", "GA", "IL", "IN", "KY", "MA", "MD", "MI", "MN", "MO", "NC", "NJ", "NY", "OH", "PA", "SC", "TN", "TX", "VA", "WI"],
  },
];

/**
 * Lenders for a state — regional specialists that explicitly list the state
 * first (strongest local signal), then the nationwide programs.
 */
export function lendersFor(state: string): Lender[] {
  const s = state.toUpperCase();
  const regional = HARD_MONEY_LENDERS.filter((l) => l.states !== "nationwide" && l.states.includes(s));
  const national = HARD_MONEY_LENDERS.filter((l) => l.states === "nationwide");
  return [...regional, ...national];
}

/** Targeted search for local/boutique lenders we don't have in the roster. */
export function lenderSearchUrl(city: string, state: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`hard money construction lender ${city} ${state}`)}`;
}
