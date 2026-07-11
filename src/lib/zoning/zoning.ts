/**
 * Zoning X-ray: address → district → what the bylaw actually allows.
 *
 * Three honesty tiers, clearly labeled in the UI:
 *  1. WIRED cities — the zone comes live from the city's own public records
 *     (address-matched open-data table first, GIS point query second), and the
 *     rules table is hand-verified against the published code (source per zone).
 *  2. RULES-ONLY cities — the user picks/confirms the zone; verified rules apply.
 *  3. EVERYWHERE ELSE — manual mode: the user types the numbers from their
 *     city's code (we link it) and Pencil computes the envelope. Accurate by
 *     construction.
 * Never a guessed regulation: anything not verified simply isn't shown.
 */

export interface ZoneRules {
  code: string;
  name: string;
  /** What housing the district allows. */
  uses: string;
  /** Max dwelling units per lot (post-reform where applicable). */
  maxUnits?: number;
  /** Minimum lot area per unit (sf) — units = floor(lot / this), capped by maxUnits. */
  minLotPerUnitSqft?: number;
  /** Floor-area ratio (total buildable = FAR × lot). */
  far?: number;
  /** Max impervious/building coverage as a fraction of the lot. */
  coverage?: number;
  /** Typical max stories used with coverage to bound buildable area. */
  stories?: number;
  heightFt?: number;
  setbacks?: { front: string; side: string; rear: string };
  /** Numeric setbacks (ft) — only where the code's values are plain numbers;
   * powers the buildable-footprint bound when lot width/depth are known. */
  setbackFt?: { front: number; side: number; rear: number };
  /** Where these numbers come from — shown in the UI. */
  source: string;
  notes?: string;
}

export interface CityZoning {
  state: string;
  /** Socrata "zoning by address" dataset — address-matched, most precise. */
  socrataZoning?: string;
  /** ArcGIS server root that hosts the zoning polygons (layer self-discovered). */
  gisServer?: string;
  /** Link to the official code for verification / manual mode. */
  codeUrl: string;
  codeName: string;
  /** Special case: the city has no zoning at all. */
  noZoning?: string;
  zones?: ZoneRules[];
}

export const CITY_ZONING: Record<string, CityZoning> = {
  Austin: {
    state: "TX",
    // City of Austin "Zoning by Address" open dataset (same portal as our live
    // Austin permits feed) — address-matched zoning straight from the city.
    socrataZoning: "https://data.austintexas.gov/resource/nbzi-qabm.json",
    // District polygons live in ZoningProfile (layer "Zoning") — NOT Shared/Zoning_2,
    // which holds overlay layers only.
    gisServer: "https://maps.austintexas.gov/arcgis/rest/services/ZoningProfile/ZoningProfile/MapServer",
    codeUrl: "https://library.municode.com/tx/austin/codes/land_development_code?nodeId=TIT25LADE_CH25-2ZO_SUBCHAPTER_CUSDERE_ART2PRUSDERE_DIV1RETA_S25-2-492SIDERE",
    codeName: "Austin LDC § 25-2-492 + HOME amendments (2023–24)",
    zones: [
      {
        code: "SF-1", name: "Single-Family (Large Lot)", uses: "Single-family; up to 3 units under HOME",
        maxUnits: 3, minLotPerUnitSqft: 1800, coverage: 0.4, stories: 2, heightFt: 35,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "LDC § 25-2-492; HOME Phase 1–2",
        notes: "HOME Phase 2 (2024) allows lots as small as ~1,800 sf per unit — verify current status with the city.",
      },
      {
        code: "SF-2", name: "Single-Family (Standard Lot)", uses: "Single-family; up to 3 units under HOME",
        maxUnits: 3, minLotPerUnitSqft: 1800, coverage: 0.4, stories: 2, heightFt: 35,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "LDC § 25-2-492; HOME Phase 1–2",
      },
      {
        code: "SF-3", name: "Family Residence", uses: "Single-family, duplex; up to 3 units under HOME",
        maxUnits: 3, minLotPerUnitSqft: 1800, coverage: 0.45, stories: 2, heightFt: 35,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "LDC § 25-2-492; HOME Phase 1–2",
      },
      {
        code: "SF-6", name: "Townhouse & Condominium", uses: "Townhomes, condos, small multifamily",
        minLotPerUnitSqft: 1600, coverage: 0.4, stories: 3, heightFt: 35,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "LDC § 25-2-492",
      },
      {
        code: "MF-3", name: "Multifamily (Medium Density)", uses: "Apartments / condos",
        minLotPerUnitSqft: 1000, coverage: 0.55, stories: 3, heightFt: 40,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "LDC § 25-2-492",
      },
    ],
  },
  Chicago: {
    state: "IL",
    codeUrl: "https://secondcityzoning.org/zoning_rules/",
    codeName: "Chicago Zoning Ordinance § 17-2 (residential district tables)",
    zones: [
      { code: "RS-1", name: "Residential Single-Unit", uses: "Single-family", maxUnits: 1, minLotPerUnitSqft: 6250, far: 0.5, heightFt: 30, setbacks: { front: "20 ft (or block average)", side: "combined ≥ 20% of lot width", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RS-2", name: "Residential Single-Unit", uses: "Single-family", maxUnits: 1, minLotPerUnitSqft: 5000, far: 0.65, heightFt: 30, setbacks: { front: "20 ft (or block average)", side: "combined ≥ 20% of lot width", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RS-3", name: "Residential Single-Unit (2-flat eligible)", uses: "Single-family; 2-flat on qualifying lots", minLotPerUnitSqft: 2500, far: 0.9, heightFt: 30, setbacks: { front: "20 ft (or block average)", side: "combined ≥ 20% of lot width", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RT-3.5", name: "Residential Two-Flat/Townhouse", uses: "2-flats, townhouses", minLotPerUnitSqft: 1250, far: 1.05, heightFt: 35, setbacks: { front: "block average", side: "combined ≥ 20% of lot width", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RT-4", name: "Residential Two-Flat/Townhouse/Multi", uses: "2-flats, townhouses, small multifamily", minLotPerUnitSqft: 1000, far: 1.2, heightFt: 38, setbacks: { front: "block average", side: "combined ≥ 20% of lot width", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RM-4.5", name: "Residential Multi-Unit", uses: "Multifamily", minLotPerUnitSqft: 700, far: 1.7, heightFt: 45, setbacks: { front: "block average", side: "per code", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RM-5", name: "Residential Multi-Unit", uses: "Multifamily", minLotPerUnitSqft: 400, far: 2.0, heightFt: 45, setbacks: { front: "block average", side: "per code", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
    ],
  },
  Houston: {
    state: "TX",
    codeUrl: "https://www.houstontx.gov/planning/DevelopRegs/",
    codeName: "Houston Ch. 42 development regulations",
    noZoning:
      "Houston has NO zoning code — use is governed by private deed restrictions plus Chapter 42 development rules (typical minimum lot: 3,500 sf inside Loop 610 / 5,000 sf outside; setbacks depend on street class). Check the deed restrictions for the specific lot.",
  },
  Dallas: {
    state: "TX",
    codeUrl: "https://codelibrary.amlegal.com/codes/dallas/latest/dallas_tx/0-0-0-28247",
    codeName: "Dallas Development Code ch. 51A (§ 51A-4.110 residential districts)",
    zones: [
      {
        code: "R-16(A)", name: "Single Family (16,000 sf lots)",
        uses: "1 house per lot (ADUs only via overlay district or Board of Adjustment)",
        maxUnits: 1, stories: 2,
        setbacks: { front: "35 ft", side: "10 ft (some sources say 15 — verify)", rear: "10 ft (verify)" },
        source: "Dallas Dev. Code § 51A-4.112",
        notes: "Min lot 16,000 sf. Published height (30 vs 36 ft) and coverage (40 vs 45%) figures conflict — verify § 51A-4.112(f) before relying.",
      },
      {
        code: "R-10(A)", name: "Single Family (10,000 sf lots)",
        uses: "1 house per lot (ADUs only via overlay or BOA)",
        maxUnits: 1, stories: 2,
        setbacks: { front: "30 ft", side: "10 ft (verify)", rear: "10 ft (verify)" },
        source: "Dallas Dev. Code § 51A-4.112",
        notes: "Min lot 10,000 sf. Coverage figures conflict in published sources — verify with the city.",
      },
      {
        code: "R-7.5(A)", name: "Single Family (7,500 sf lots)",
        uses: "1 house per lot (ADUs only via overlay or BOA)",
        maxUnits: 1, coverage: 0.45, stories: 2, heightFt: 36,
        setbacks: { front: "25 ft", side: "5 ft", rear: "5 ft" },
        setbackFt: { front: 25, side: 5, rear: 5 },
        source: "Dallas Dev. Code § 51A-4.112",
        notes: "Min lot 7,500 sf — Dallas's most common single-family district.",
      },
      {
        code: "R-5(A)", name: "Single Family (5,000 sf lots)",
        uses: "1 house per lot (ADUs only via overlay or BOA)",
        maxUnits: 1, coverage: 0.55, stories: 2,
        setbacks: { front: "20 ft", side: "5 ft", rear: "5 ft" },
        setbackFt: { front: 20, side: 5, rear: 5 },
        source: "Dallas Dev. Code § 51A-4.112",
        notes: "Min lot 5,000 sf. TX SB 15 (eff. Sept 2025): in qualifying NEW subdivisions, cities can't require lots over 3,000 sf.",
      },
      {
        code: "D(A)", name: "Duplex District",
        uses: "Duplex (2 units on one lot); single-family also permitted",
        maxUnits: 2, minLotPerUnitSqft: 3000, stories: 2, heightFt: 36,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "Dallas Dev. Code § 51A-4.113",
        notes: "6,000 sf minimum lot for duplex use; no FAR and no density cap in this district. Coverage figure (60%) is single-sourced — verify.",
      },
      {
        code: "TH-3(A)", name: "Townhouse District",
        uses: "Attached townhouses/rowhouses; detached single-family also permitted",
        minLotPerUnitSqft: 3630, heightFt: 36, stories: 3,
        setbacks: { front: "per § 51A-4.114 — verify", side: "15 ft between groups of ≤8 units", rear: "per § 51A-4.114 — verify" },
        source: "Dallas Dev. Code § 51A-4.114",
        notes: "Density 12 du/ac (TH-2(A) is 9, TH-1(A) is 6). Coverage: 80% of an individual lot allowed if total project coverage ≤60% with ≥40% open space.",
      },
      {
        code: "MF-1(A)", name: "Multifamily (low/medium)",
        uses: "Multifamily; duplex and single-family also permitted",
        coverage: 0.6, stories: 3, heightFt: 36,
        setbacks: { front: "15 ft", side: "10–15 ft (adjacency formula)", rear: "10–15 ft (adjacency formula)" },
        source: "Dallas Dev. Code § 51A-4.116",
        notes: "No max density; minimum lot area per unit runs on a bedroom-count schedule in § 51A-4.116 — check it for your unit mix. Mixed-income bonuses can waive per-unit minimums.",
      },
      {
        code: "MF-2(A)", name: "Multifamily (medium)",
        uses: "Multifamily; duplex and single-family also permitted",
        minLotPerUnitSqft: 1000, coverage: 0.6, stories: 3, heightFt: 36,
        setbacks: { front: "15 ft", side: "10–15 ft (adjacency formula)", rear: "10–15 ft (adjacency formula)" },
        source: "Dallas Dev. Code § 51A-4.116",
        notes: "Per-unit lot area by bedrooms: efficiency 800 / 1-BR 1,000 / 2-BR 1,200 sf (1-BR used for the unit estimate). No FAR, no density cap; 36 ft ≈ 3 stories. Dallas 2025 reforms: no parking minimums under 20 units; 3–8 unit buildings ≤3 stories permit under the residential code.",
      },
    ],
  },
  "Fort Worth": {
    state: "TX",
    codeUrl: "https://codelibrary.amlegal.com/codes/ftworth/latest/ftworth_tx/0-0-0-34983",
    codeName: "Fort Worth Zoning Ordinance ch. 4 (§§ 4.701–4.713)",
    zones: [
      {
        code: "A-21", name: "One-Family (half-acre lots)",
        uses: "1 house per lot; ADUs accessory-only (≤900 sf, not a separate residence — § 5.301)",
        maxUnits: 1, heightFt: 35, stories: 2,
        setbacks: { front: "per § 4.702 — verify", side: "per § 4.702 — verify", rear: "per § 4.702 — verify" },
        source: "Fort Worth Zoning Ord. § 4.702",
        notes: "Min lot 21,780 sf (½ acre).",
      },
      {
        code: "A-10", name: "One-Family (10,000 sf lots)",
        uses: "1 house per lot; ADUs accessory-only (§ 5.301)",
        maxUnits: 1, heightFt: 35, stories: 2,
        setbacks: { front: "per § 4.703 — verify", side: "per § 4.703 — verify", rear: "10 ft (cited in BOA cases)" },
        source: "Fort Worth Zoning Ord. § 4.703",
        notes: "Min lot 10,000 sf.",
      },
      {
        code: "A-7.5", name: "One-Family (7,500 sf lots)",
        uses: "1 house per lot; ADUs accessory-only (§ 5.301)",
        maxUnits: 1, heightFt: 35, stories: 2,
        setbacks: { front: "20 ft", side: "per § 4.704 — verify", rear: "per § 4.704 — verify" },
        source: "Fort Worth Zoning Ord. § 4.704",
        notes: "Min lot 7,500 sf.",
      },
      {
        code: "A-5", name: "One-Family (5,000 sf lots)",
        uses: "1 house per lot; ADUs accessory-only (≤900 sf — § 5.301)",
        maxUnits: 1, heightFt: 35, stories: 2,
        setbacks: { front: "20 ft (typical — verify)", side: "5 ft", rear: "5 ft" },
        source: "Fort Worth Zoning Ord. § 4.705",
        notes: "Min lot 5,000 sf. TX SB 15 (eff. Sept 2025): qualifying new subdivisions can't be forced above 3,000 sf lots.",
      },
      {
        code: "B", name: "Two-Family District",
        uses: "Duplex (2 units/lot); attached zero-lot-line two-family on 2,500 sf lots at up to 13 du/ac",
        maxUnits: 2, heightFt: 35, stories: 2,
        setbacks: { front: "20 ft", side: "5 ft", rear: "per § 4.707 — verify" },
        source: "Fort Worth Zoning Ord. § 4.707",
      },
      {
        code: "R2", name: "Townhouse/Cluster District",
        uses: "Attached townhouses/rowhouses, clustered dwellings (+B/R1 uses)",
        minLotPerUnitSqft: 3630,
        setbacks: { front: "per § 4.709 — verify", side: "per § 4.709 — verify", rear: "per § 4.709 — verify" },
        source: "Fort Worth Zoning Ord. § 4.709",
        notes: "Max 12 du/ac, max 10 attached units per building, min 15% open space.",
      },
      {
        code: "C", name: "Medium Density Multifamily",
        uses: "Multifamily 3+ units (site plan required); lower-intensity residential also permitted",
        minLotPerUnitSqft: 1815, heightFt: 45, stories: 3,
        setbacks: { front: "per § 4.711 — verify", side: "per § 4.711 — verify", rear: "per § 4.711 — verify" },
        source: "Fort Worth Zoning Ord. § 4.711",
        notes: "Max 24 du/ac on average; multifamily standards of § 6.506 apply (e.g. 250 ft max facade length).",
      },
      {
        code: "D", name: "High Density Multifamily",
        uses: "High-density multifamily (site plan required)",
        minLotPerUnitSqft: 1361,
        setbacks: { front: "per § 4.712 — verify", side: "per § 4.712 — verify", rear: "per § 4.712 — verify" },
        source: "Fort Worth Zoning Ord. § 4.712",
        notes: "Reported up to ~32 du/ac — the site plan sets the actual cap; verify with the city. Height per site plan.",
      },
    ],
  },
  "Los Angeles": {
    state: "CA",
    codeUrl: "https://planning.lacity.gov/odocument/eadcb225-a16b-4ce6-bc94-c915408c2b04/Zoning_Code_Summary.pdf",
    codeName: "LAMC Ch. 1 Art. 2 (DCP CP-7150 zoning summary, rev. Jan 2026)",
    zones: [
      {
        code: "R1", name: "One-Family Zone",
        uses: "1 house; state law stacks more: SB 9 duplex + ADU + JADU (LA accepts SB 9 applications)",
        maxUnits: 4, far: 0.45, stories: 2, heightFt: 33,
        setbacks: { front: "20% of lot depth, max 20 ft (or prevailing)", side: "5 ft (narrow lots: 10% of width, min 3 ft)", rear: "15 ft" },
        setbackFt: { front: 20, side: 5, rear: 15 },
        source: "LAMC § 12.08; height/FAR § 12.21.1",
        notes: "0.45 is the Baseline Mansionization max Residential Floor Area (45% of lot), not classic FAR; height 33 ft (28 ft low-slope roofs). Min lot 5,000 sf / 50 ft. Unit count assumes the verified state-law stack (SB 9 two units + ADU + JADU) — hillside/coastal areas differ.",
      },
      {
        code: "R2", name: "Two-Family Zone",
        uses: "Duplex / two-family + R1 uses",
        minLotPerUnitSqft: 2500, far: 3.0,
        setbacks: { front: "same as R1 (20% of depth, max 20 ft)", side: "5 ft", rear: "15 ft" },
        setbackFt: { front: 20, side: 5, rear: 15 },
        source: "LAMC § 12.09; § 12.21.1",
        notes: "FAR 3:1 applies in Height District 1 — check the parcel's HD suffix (1XL: 2 st/30 ft, 1VL: 3 st/45 ft, 1L: 6 st/75 ft). The 2,500 sf/unit density cap usually binds first. Min lot 5,000 sf.",
      },
      {
        code: "RD1.5", name: "Restricted Density Multiple Dwelling",
        uses: "Two-family / multiple dwellings, small apartments",
        minLotPerUnitSqft: 1500, far: 3.0,
        setbacks: { front: "15 ft", side: "5 ft (≤2 stories)", rear: "15 ft" },
        setbackFt: { front: 15, side: 5, rear: 15 },
        source: "LAMC § 12.09.1; § 12.21.1",
        notes: "FAR 3:1 in Height District 1 — density (1,500 sf/unit) usually binds first.",
      },
      {
        code: "RD2", name: "Restricted Density Multiple Dwelling",
        uses: "Two-family / multiple dwellings, small apartments",
        minLotPerUnitSqft: 2000, far: 3.0,
        setbacks: { front: "15 ft", side: "5 ft (≤2 stories)", rear: "15 ft" },
        setbackFt: { front: 15, side: 5, rear: 15 },
        source: "LAMC § 12.09.1; § 12.21.1",
        notes: "2,000 sf of lot per unit; FAR 3:1 in Height District 1.",
      },
      {
        code: "R3", name: "Multiple Dwelling Zone",
        uses: "Apartment houses, multifamily + R2 uses",
        minLotPerUnitSqft: 800, far: 3.0,
        setbacks: { front: "15 ft (10 ft key lots)", side: "5 ft +1 ft/story above 2nd (max 16 ft)", rear: "15 ft" },
        setbackFt: { front: 15, side: 5, rear: 15 },
        source: "LAMC § 12.10; § 12.21.1",
        notes: "800 sf of lot per unit; FAR 3:1 in Height District 1 (1XL 30 ft/2 st, 1VL 45 ft/3 st, 1L 75 ft/6 st where mapped).",
      },
      {
        code: "R4", name: "Multiple Dwelling Zone (higher density)",
        uses: "R3 uses + apartment hotels, institutional",
        minLotPerUnitSqft: 400, far: 3.0,
        setbacks: { front: "15 ft", side: "5 ft +1 ft/story above 2nd (max 16 ft)", rear: "15 ft +1 ft/story above 3rd (max 20 ft)" },
        setbackFt: { front: 15, side: 5, rear: 15 },
        source: "LAMC § 12.11; § 12.21.1",
        notes: "400 sf of lot per unit; FAR 3:1 in HD1, 6:1 in HD2 — read zone + height district together.",
      },
    ],
  },
  Phoenix: {
    state: "AZ",
    codeUrl: "https://phoenix.municipal.codes/ZO",
    codeName: "Phoenix Zoning Ordinance ch. 6 (as amended by Ord. G-7446, Jan 2026)",
    zones: [
      {
        code: "R1-6", name: "Single-Family Residence",
        uses: "1 house + up to 2 ADUs (AZ HB 2720); 4 units/lot in the downtown Middle Housing Overlay",
        maxUnits: 3, coverage: 0.4, stories: 2, heightFt: 30,
        setbacks: { front: "20 ft", side: "5 ft", rear: "15 ft (standard option)" },
        setbackFt: { front: 20, side: 5, rear: 15 },
        source: "Phoenix Zoning Ord. § 613; city zoning FAQ handout",
        notes: "Min lot 6,000 sf. Ord. G-7446 (Jan 2026) allows up to 4 primary units/lot within ~1 mile of downtown (MHOD).",
      },
      {
        code: "R1-8", name: "Single-Family Residence",
        uses: "1 house + up to 2 ADUs (AZ HB 2720)",
        maxUnits: 3, coverage: 0.35, stories: 2, heightFt: 30,
        setbacks: { front: "25 ft", side: "7 ft", rear: "20 ft (standard option)" },
        setbackFt: { front: 25, side: 7, rear: 20 },
        source: "Phoenix Zoning Ord. § 612",
        notes: "Min lot 8,000 sf.",
      },
      {
        code: "R1-10", name: "Single-Family Residence",
        uses: "1 house + up to 2 ADUs (AZ HB 2720)",
        maxUnits: 3, coverage: 0.3, stories: 2,
        setbacks: { front: "25 ft", side: "10 ft", rear: "25 ft (standard option)" },
        setbackFt: { front: 25, side: 10, rear: 25 },
        source: "Phoenix Zoning Ord. § 611",
        notes: "Min lot 10,000 sf. Height limit per § 611 — verify the district cap with the city.",
      },
      {
        code: "R1-14", name: "One-Family Residence (legacy district)",
        uses: "1 house + up to 2 ADUs (AZ HB 2720)",
        maxUnits: 3,
        setbacks: { front: "30 ft", side: "10 ft (street side 15 ft)", rear: "20 ft (same as RE-24)" },
        setbackFt: { front: 30, side: 10, rear: 20 },
        source: "Phoenix Zoning Ord. § 607 (setbacks cross-ref § 606)",
        notes: "Min lot 14,000 sf / 110 ft wide. Coverage and height per § 607 — verify with the city (recently amended by the ADU ordinance).",
      },
      {
        code: "R-2", name: "Multi-Family Residence (low)",
        uses: "Duplexes, townhomes, small multifamily, single-family",
        minLotPerUnitSqft: 4356, stories: 2,
        setbacks: { front: "per § 614 tables — verify", side: "per § 614 tables — verify", rear: "per § 614 tables — verify" },
        source: "Phoenix Zoning Ord. § 614; city districts handout",
        notes: "Density ~10 du/ac standard (to 12 with bonus) — converted to sf/unit. Within 10 ft of a single-family district height is capped at 15 ft, +1 ft per extra ft of setback. PRD option: +1% density per 2% common open space.",
      },
      {
        code: "R-3", name: "Multi-Family Residence (medium)",
        uses: "Multifamily — rental, condo, townhome",
        minLotPerUnitSqft: 3000, stories: 3,
        setbacks: { front: "per § 615 tables — verify", side: "per § 615 tables — verify", rear: "per § 615 tables — verify" },
        source: "Phoenix Zoning Ord. § 615; city districts handout",
        notes: "Density ~14.5 du/ac standard (17.4 bonus). Purpose text allows staggered heights up to 3–4 stories; the 15-ft rule applies near single-family districts.",
      },
      {
        code: "R-3A", name: "Multi-Family Residence (mid-density)",
        uses: "Multifamily, limited",
        minLotPerUnitSqft: 1980, stories: 3,
        setbacks: { front: "per § 616 tables — verify", side: "per § 616 tables — verify", rear: "per § 616 tables — verify" },
        source: "Phoenix Zoning Ord. § 616; city districts handout",
        notes: "Density ~22 du/ac standard (26.4 bonus); heights up to 3–4 stories per purpose text.",
      },
      {
        code: "R-4", name: "Multi-Family Residence (higher density)",
        uses: "Multifamily, limited",
        minLotPerUnitSqft: 1500, stories: 3,
        setbacks: { front: "per § 617 tables — verify", side: "per § 617 tables — verify", rear: "per § 617 tables — verify" },
        source: "Phoenix Zoning Ord. § 617; city districts handout",
        notes: "Density ~29 du/ac standard (34.8 bonus); heights up to 3–4 stories per purpose text.",
      },
    ],
  },
  "Miami Beach": {
    state: "FL",
    codeUrl: "https://library.municode.com/fl/miami_beach/codes/resiliency_code_(current_land_development_regulations)",
    codeName: "Miami Beach Resiliency Code Ch. 7 (eff. June 2023; formerly Ch. 142)",
    zones: (() => {
      // RS-1..RS-4 differ mainly by minimum lot size (which the city publishes
      // in the § 7.2.2 tables); the intensity standards below are shared.
      const rs = (code: string, name: string): ZoneRules => ({
        code, name,
        uses: "Single-family detached only (accessory ADU/guesthouse allowed; no standalone rental)",
        maxUnits: 1, far: 0.5, coverage: 0.3, stories: 2,
        setbacks: { front: "20 ft (2nd floor +10 ft more)", side: "greater of 5 ft or 10% of lot width", rear: "per § 7.2.2 — verify with the city" },
        source: "Resiliency Code § 7.2.2 (former § 142-105/-106)",
        notes: "0.5 isn't FAR — it's the max home size: 50% of lot area, up to 60% via administrative review. Coverage 30% for two-story homes; height is 2 stories above base flood elevation.",
      });
      return [
        rs("RS-1", "Single-Family Residential (largest lots)"),
        rs("RS-2", "Single-Family Residential"),
        rs("RS-3", "Single-Family Residential"),
        rs("RS-4", "Single-Family Residential (smallest lots)"),
        {
          code: "RM-1", name: "Residential Multifamily, Low Intensity",
          uses: "Multifamily, townhomes, single-family", far: 1.25, heightFt: 50,
          setbacks: { front: "per § 7.2.4 tables", side: "per § 7.2.4 tables", rear: "per § 7.2.4 tables" },
          source: "Resiliency Code § 7.2.4 (former § 142-155)",
          notes: "FAR 1.4 on the west side of Collins Ave (76th–79th St). Density is controlled by FAR + citywide minimum unit sizes (550 sf new construction), not units/acre. Height has area-specific exceptions.",
        },
        {
          code: "RM-2", name: "Residential Multifamily, Medium Intensity",
          uses: "Multifamily, apartment-hotels, hotels, townhomes", far: 2.0,
          setbacks: { front: "per § 7.2.5 tables", side: "per § 7.2.5 tables", rear: "per § 7.2.5 tables" },
          source: "Resiliency Code § 7.2.5 (former §§ 142-212–218)",
          notes: "Height varies by sub-area (oceanfront vs. interior) — check the § 7.2.5 location tables.",
        },
      ];
    })(),
  },
  Miami: {
    state: "FL",
    codeUrl: "https://www.miami.gov/Planning-Zoning-Land-Use/View-City-of-Miami-Zoning-Code-Miami-21",
    codeName: "Miami 21 form-based code (Art. 4 Table 2 + Art. 5)",
    zones: [
      {
        code: "T3-R", name: "Sub-Urban, Restricted",
        uses: "Single-family only",
        maxUnits: 1, minLotPerUnitSqft: 4840, coverage: 0.5, stories: 2,
        setbacks: { front: "20 ft", side: "5 ft", rear: "15–20 ft (published values conflict — see Art. 5 Illus. 5.3)" },
        source: "Miami 21 Art. 4 Table 2; Art. 5 § 5.3",
        notes: "Min lot 5,000 sf / 50 ft wide; density 9 du/ac; second-story coverage additionally capped at 30%.",
      },
      {
        code: "T3-L", name: "Sub-Urban, Limited",
        uses: "Single-family + one ancillary unit (ADU)",
        maxUnits: 2, coverage: 0.5, stories: 2,
        setbacks: { front: "20 ft", side: "5 ft", rear: "15–20 ft (published values conflict — see Art. 5 Illus. 5.3)" },
        source: "Miami 21 Art. 4 Table 2; Art. 5 § 5.3",
        notes: "Min lot 5,000 sf / 50 ft wide; 9 du/ac density; second-story coverage capped at 30%.",
      },
      {
        code: "T3-O", name: "Sub-Urban, Open",
        uses: "Single-family or duplex (two units at the frontage)",
        maxUnits: 2, minLotPerUnitSqft: 2420, coverage: 0.5, stories: 2,
        setbacks: { front: "20 ft", side: "5 ft", rear: "15–20 ft (published values conflict — see Art. 5 Illus. 5.3)" },
        source: "Miami 21 Art. 4 Table 2; Art. 5 § 5.3",
        notes: "Min lot 5,000 sf / 50 ft wide; density 18 du/ac.",
      },
      {
        code: "T4-R", name: "General Urban, Restricted",
        uses: "Rowhouses, townhomes, small apartment buildings",
        minLotPerUnitSqft: 1210, coverage: 0.6, stories: 3,
        setbacks: { front: "10 ft", side: "0–5 ft (context-dependent)", rear: "per Art. 5 Illus. 5.4" },
        source: "Miami 21 Art. 4 Table 2; Art. 5 § 5.4",
        notes: "Density 36 du/ac. No FAR in T4 — form-controlled.",
      },
      {
        code: "T5-R", name: "Urban Center, Restricted",
        uses: "Multifamily (residential only)",
        minLotPerUnitSqft: 670, coverage: 0.8, stories: 5,
        setbacks: { front: "10 ft", side: "0 ft (graduated abutting T3)", rear: "0 ft (graduated abutting T3)" },
        source: "Miami 21 Art. 4 Table 2; Art. 5 § 5.5",
        notes: "Density 65 du/ac. Graduated setbacks apply where the lot abuts T3.",
      },
      {
        code: "T6-8-R", name: "Urban Core, Restricted (8-story tier)",
        uses: "High-density multifamily",
        minLotPerUnitSqft: 290, far: 5.0, coverage: 0.8, stories: 8,
        setbacks: { front: "10 ft", side: "0 ft (tower setbacks above 8th story)", rear: "0 ft (tower setbacks above 8th story)" },
        source: "Miami 21 Art. 4 Table 2; Art. 5 § 5.6; Art. 3 § 3.14",
        notes: "Density 150 du/ac. 5.0 is FLR (Miami 21's FAR); +25% via the Public Benefits Program, bonus to 12 stories — bonus unavailable abutting T3.",
      },
    ],
  },
  Seattle: {
    state: "WA",
    codeUrl: "https://www.seattle.gov/sdci/codes/codes-we-enforce-(a-z)/neighborhood-residential-code",
    codeName: "SMC Title 23 — NR zone standards per Ordinance 127376 (effective Jan 21, 2026)",
    zones: (() => {
      // Ordinance 127376 (Dec 2025, eff. Jan 21, 2026) repealed NR1/NR2/NR3 and
      // replaced them with a single NR zone. Parcels and GIS records still carry
      // the old labels, but the NEW standards govern them — so all four codes
      // point at the current rules.
      const nr = (code: string, name: string): ZoneRules => ({
        code, name,
        uses: "House, duplex–sixplex, townhomes, stacked flats, cottages, ADUs (HB 1110 middle housing)",
        maxUnits: 6, minLotPerUnitSqft: 1250, far: 1.6, coverage: 0.5, stories: 3, heightFt: 32,
        setbacks: { front: "15 ft (10 ft for 3+ units)", side: "5 ft avg / 3 ft min", rear: "15 ft (10 ft for 3+ units; 0 at alley)" },
        setbackFt: { front: 15, side: 5, rear: 15 },
        source: "SMC ch. 23.44 as replaced by Ord. 127376 (One Seattle Plan)",
        notes: "4 units/lot by right; 6 within ¼ mi of major transit or with 2 affordable units. FAR is tiered 0.6–1.6 by density (1.6 at ≥1 unit/1,600 sf; stacked-flat/green bonuses to ~2.0); footprint uses the conservative 1–2-unit setbacks.",
      });
      return [
        nr("NR", "Neighborhood Residential (2026 consolidated zone)"),
        nr("NR1", "Neighborhood Residential 1 (label retired — NR standards govern)"),
        nr("NR2", "Neighborhood Residential 2 (label retired — NR standards govern)"),
        nr("NR3", "Neighborhood Residential 3 (label retired — NR standards govern)"),
      ];
    })(),
  },
  Denver: {
    state: "CO",
    codeUrl: "https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Community-Planning-and-Development/Denver-Zoning-Code",
    codeName: "Denver Zoning Code (form-based, Articles 3–6)",
    zones: [
      {
        code: "U-SU-C", name: "Urban Single Unit C",
        uses: "1 house + 1 ADU (ADUs citywide since Dec 2024)",
        maxUnits: 2, coverage: 0.375, stories: 2.5, heightFt: 30,
        setbacks: { front: "block-sensitive, else 20 ft", side: "5 ft", rear: "12 ft (alley) / 20 ft" },
        setbackFt: { front: 20, side: 5, rear: 20 },
        source: "DZC Art. 5, Div. 5.3 form tables (read from the published code)",
        notes: "Min zone lot 5,500 sf / 50 ft wide. Height 2.5 stories; 30 ft in the front 65% of the lot, 17 ft in the rear 35%. Footprint uses the no-alley 20 ft rear — most Denver lots with alleys get 12 ft.",
      },
      {
        code: "U-TU-C", name: "Urban Two Unit C",
        uses: "Duplex / tandem house — 2 units; ADU rules expanded citywide Dec 2024",
        maxUnits: 2, coverage: 0.375, stories: 2.5, heightFt: 30,
        setbacks: { front: "block-sensitive, else 20 ft", side: "5 ft", rear: "12 ft (alley) / 20 ft" },
        setbackFt: { front: 20, side: 5, rear: 20 },
        source: "DZC Art. 5, Div. 5.3 duplex form table (read from the published code)",
        notes: "Min zone lot 5,500 sf / 50 ft wide. A third accessory unit may be possible under the 2024 citywide ADU ordinance — verify composition with CPD.",
      },
      {
        code: "S-SU-D", name: "Suburban Single Unit D",
        uses: "1 house + 1 ADU (ADUs citywide since Dec 2024)",
        maxUnits: 2, coverage: 0.375, stories: 2.5, heightFt: 30,
        setbacks: { front: "20 ft (block-sensitive)", side: "5 ft", rear: "per form table — verify with CPD" },
        source: "DZC Art. 3 (Suburban House form); min lot 6,000 sf",
        notes: "Rear setback varies by form/alley — not encoded, so no footprint bound in this district.",
      },
      {
        code: "S-SU-F", name: "Suburban Single Unit F",
        uses: "1 house + 1 ADU (ADUs citywide since Dec 2024)",
        maxUnits: 2, coverage: 0.375, stories: 2.5, heightFt: 30,
        setbacks: { front: "20 ft (block-sensitive)", side: "5 ft", rear: "per form table — verify with CPD" },
        source: "DZC Art. 3 (Suburban House form); min lot 8,500 sf",
      },
      {
        code: "E-SU-D", name: "Urban Edge Single Unit D (incl. -DX variants)",
        uses: "1 house + 1 ADU (the 'x' ADU suffix is redundant since Dec 2024)",
        maxUnits: 2, stories: 2.5, heightFt: 30,
        setbacks: { front: "per form table — verify", side: "per form table — verify", rear: "per form table — verify" },
        source: "DZC Art. 4 (Urban Edge); min lot 6,000 sf",
        notes: "Published third-party setback/coverage figures conflict for E-context — Pencil shows only what's verified; use the DZC form table for exact yards.",
      },
    ],
  },
};

/** ArcGIS layer self-discovery + point query, reusing the permits pattern. */
async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function zoneAtPoint(gisServer: string, lat: number, lng: number): Promise<string | null> {
  try {
    const meta = (await getJson(`${gisServer}?f=json`)) as { layers?: { id: number; name: string }[] };
    // Exact "Zoning" layer first, then a conservative name match. Never fall
    // back to an arbitrary layer — a wrong layer means a wrong answer.
    const layer =
      meta.layers?.find((l) => l.name.trim().toLowerCase() === "zoning") ??
      meta.layers?.find((l) => /zoning(?!.*(case|pending|overlay|historic|profile))/i.test(l.name));
    if (!layer) return null;
    const q = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "false",
      f: "json",
    });
    const data = (await getJson(`${gisServer}/${layer.id}/query?${q}`)) as {
      features?: { attributes?: Record<string, unknown> }[];
    };
    const attrs = data.features?.[0]?.attributes;
    if (!attrs) return null;
    return pickZoneValue(attrs);
  } catch {
    return null;
  }
}

/**
 * Find the zone code in a record without hardcoding a schema: a zoning-named
 * key (excluding case numbers, ordinances, dates, ids) whose value looks like
 * a district code. Returns null rather than guess.
 */
function pickZoneValue(rec: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(rec)) {
    if (!/^(zoning|zone|ztype|base_?zone|zone_?class|district)/i.test(k)) continue;
    if (/case|ordinance|date|_id$|url|link|desc/i.test(k)) continue;
    if (typeof v === "string" && v.trim() && v.trim().length <= 20 && !/\d{4}/.test(v)) return v.trim();
  }
  return null;
}

/**
 * Address-matched zone from a city's own "zoning by address" open dataset
 * (Socrata full-text search — schema-agnostic, so a portal-side rename
 * degrades to null instead of a wrong answer).
 */
/** House number + street name, suffix dropped ("Ln" vs "LANE") and ordinals
 * bared ("5th" → "5", matching how assessor tables store numbered streets). */
function streetQuery(streetAddress: string): string {
  const m = streetAddress.trim().match(
    /^(\d+[A-Za-z]?)\s+([A-Za-z0-9'. -]+?)(?:\s+(?:st|street|ave|avenue|blvd|boulevard|dr|drive|ln|lane|rd|road|ct|court|cir|circle|way|pl|place|trl|trail|pkwy|parkway|cv|cove|loop|bnd|bend|pass|path|run|holw|hollow|ter|terrace|hwy|highway|expy|expressway))?\.?\s*$/i,
  );
  const q = m ? `${m[1]} ${m[2]}` : streetAddress.trim();
  return q.replace(/(\d+)(?:st|nd|rd|th)\b/gi, "$1");
}

export async function zoneAtAddress(datasetUrl: string, streetAddress: string): Promise<string | null> {
  try {
    const q = streetQuery(streetAddress);
    const res = await fetch(`${datasetUrl}?$q=${encodeURIComponent(q)}&$limit=8`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows)) return null;
    for (const row of rows) {
      const zone = pickZoneValue(row);
      if (zone) return zone;
    }
    return null;
  } catch {
    return null;
  }
}

/** Match a raw GIS zone string ("SF-3-NP") to a rules entry by prefix. */
export function matchZoneRules(city: CityZoning, rawZone: string): ZoneRules | null {
  const z = rawZone.toUpperCase();
  return city.zones?.find((r) => z === r.code || z.startsWith(`${r.code}-`)) ?? null;
}

export interface ParcelInfo {
  /** Deeded/recorded lot area straight from the city or county parcel table. */
  lotSqft?: number;
  /** Zoning district recorded on the parcel (e.g. NYC PLUTO ZoneDist1). */
  zone?: string;
  /** Max residential FAR recorded on the parcel (NYC PLUTO ResidFAR). */
  residFar?: number;
  /** Recorded lot frontage / depth in feet (NYC PLUTO LotFront/LotDepth). */
  lotFront?: number;
  lotDepth?: number;
  /** Where the numbers come from — shown in the UI. */
  source: string;
}

interface ParcelSource {
  match: (city: string, state: string) => boolean;
  /** "socrata" (default): address-matched open-data table. "arcgis": county GIS point query. */
  kind?: "socrata" | "arcgis";
  /** Socrata resource URL, or ArcGIS REST services root for kind "arcgis". */
  url: string;
  source: string;
  /** Known-schema field names; omitted → strict schema-agnostic probing. */
  fields?: { lot: string; zone?: string; residFar?: string; front?: string; depth?: string; address: string };
}

const PARCEL_SOURCES: ParcelSource[] = [
  {
    // NYC PLUTO — the Dept. of City Planning's canonical tax-lot table.
    // Fields per the published PLUTO data dictionary.
    match: (c, s) => s === "NY" && /^(new york|manhattan|brooklyn|the bronx|bronx|queens|staten island)$/i.test(c),
    url: "https://data.cityofnewyork.us/resource/64uk-42ks.json",
    source: "NYC PLUTO (Dept. of City Planning)",
    fields: { lot: "lotarea", zone: "zonedist1", residFar: "residfar", front: "lotfront", depth: "lotdepth", address: "address" },
  },
  {
    // Cook County Assessor parcel universe — schema probed, never guessed.
    match: (c, s) => s === "IL" && /^chicago$/i.test(c),
    url: "https://datacatalog.cookcountyil.gov/resource/nj4t-kc8j.json",
    source: "Cook County Assessor parcel records",
  },
  {
    // Miami-Dade County GIS parcels — covers every municipality in the county
    // (Miami, Miami Beach, Coral Gables, Hialeah, …). Same server Pencil's
    // live Miami permit discovery already uses from the browser.
    match: (c, s) =>
      s === "FL" &&
      /^(miami|miami beach|north miami|north miami beach|miami gardens|miami lakes|miami springs|miami shores|coral gables|hialeah|hialeah gardens|doral|aventura|homestead|florida city|key biscayne|surfside|bal harbour|bay harbor islands|north bay village|sunny isles beach|golden beach|pinecrest|palmetto bay|cutler bay|south miami|west miami|sweetwater|opa-locka|el portal|biscayne park|virginia gardens|medley|indian creek)$/i.test(c),
    kind: "arcgis",
    // "Parcels @ PaParcel" lives under MD_LandInformation (layer self-discovered).
    url: "https://gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer",
    source: "Miami-Dade County GIS parcel records",
  },
];

/**
 * County-GIS parcel at a point: self-discover a parcel layer under the REST
 * root, query the polygon containing the geocoded point, and probe the record
 * for a lot-size value (and a zoning code where the county carries one).
 * Any miss returns null — never a guess. Request budget is kept small.
 */
async function arcgisParcelAtPoint(serverUrl: string, lat: number, lng: number): Promise<{ lotSqft?: number; zone?: string } | null> {
  const diag = (msg: string, extra?: unknown) => {
    // eslint-disable-next-line no-console
    console.info("[Pencil] parcel lookup:", msg, extra ?? "");
  };
  try {
    // Accept either a service URL (…/MapServer) or a REST root to discover from.
    const services: string[] = [];
    if (/\/(Map|Feature)Server\/?$/.test(serverUrl)) {
      services.push(serverUrl.replace(/\/$/, ""));
    } else {
      const root = (await getJson(`${serverUrl}?f=json`)) as {
        folders?: string[];
        services?: { name: string; type: string }[];
      };
      const named = (root.services ?? [])
        .filter((x) => /(^|\/)(pa|parcel|property|cadastr|land)/i.test(x.name) && /Server$/.test(x.type))
        .slice(0, 3);
      services.push(...named.map((x) => `${serverUrl}/${x.name}/${x.type}`));
      for (const f of (root.folders ?? []).filter((x) => /pa|parcel|property|cadastr|land/i.test(x)).slice(0, 2)) {
        try {
          const sub = (await getJson(`${serverUrl}/${f}?f=json`)) as { services?: { name: string; type: string }[] };
          services.push(...(sub.services ?? []).filter((x) => /Server$/.test(x.type)).slice(0, 2).map((x) => `${serverUrl}/${x.name}/${x.type}`));
        } catch { /* skip folder */ }
      }
    }
    for (const svcUrl of services.slice(0, 4)) {
      try {
        const meta = (await getJson(`${svcUrl}?f=json`)) as { layers?: { id: number; name: string }[] };
        const layer = meta.layers?.find((l) => /parcel/i.test(l.name) && !/label|anno|line|point|dissolve/i.test(l.name));
        if (!layer) { diag("no parcel layer in", svcUrl); continue; }
        const q = new URLSearchParams({
          geometry: `${lng},${lat}`,
          geometryType: "esriGeometryPoint",
          inSR: "4326",
          spatialRel: "esriSpatialRelIntersects",
          outFields: "*",
          returnGeometry: "true",
          outSR: "3857",
          f: "json",
        });
        const data = (await getJson(`${svcUrl}/${layer.id}/query?${q}`)) as {
          features?: { attributes?: Record<string, unknown>; geometry?: { rings?: number[][][] } }[];
        };
        const feat = data.features?.[0];
        if (!feat?.attributes) { diag(`no parcel at point (layer "${layer.name}")`, svcUrl); continue; }
        let lotSqft: number | undefined;
        for (const [k, v] of Object.entries(feat.attributes)) {
          if (/^(lot_?size|land_?(sq_?ft|sqft|area|size)|parcel_?(area|size))/i.test(k) && !/val|price|tax|assess|bldg|building|year|code|flag/i.test(k)) {
            const n = saneLot(num(v));
            if (n) { lotSqft = n; break; }
          }
        }
        // No recorded lot-size attribute → measure the parcel polygon itself
        // (Web Mercator shoelace, corrected by cos²(lat); ~exact at parcel scale).
        if (lotSqft == null && feat.geometry?.rings?.length) {
          let m2 = 0;
          for (const ring of feat.geometry.rings) {
            let a = 0;
            for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
            m2 += a / 2; // outer rings CW (negative), holes CCW — summing signed areas nets holes out
          }
          const cos = Math.cos((lat * Math.PI) / 180);
          lotSqft = saneLot(Math.abs(m2) * cos * cos * 10.7639);
          if (lotSqft) diag("lot size computed from parcel boundary", lotSqft);
        }
        const zone = pickZoneValue(feat.attributes) ?? undefined;
        diag("hit", { service: svcUrl, layer: layer.name, lotSqft, zone });
        if (lotSqft != null || zone) return { lotSqft, zone };
      } catch (e) {
        diag(`service failed: ${(e as Error).message}`, svcUrl);
      }
    }
    diag("no usable parcel record found");
    return null;
  } catch (e) {
    diag(`lookup failed: ${(e as Error).message}`);
    return null;
  }
}

const num = (x: unknown): number | undefined => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Sane recorded-lot-area range: rejects flags, codes, and valuation fields. */
const saneLot = (n: number | undefined): number | undefined =>
  n != null && n >= 200 && n <= 2_000_000 ? Math.round(n) : undefined;

/** Sane lot frontage/depth in feet. */
const saneDim = (n: number | undefined): number | undefined =>
  n != null && n >= 10 && n <= 2_000 ? Math.round(n) : undefined;

/**
 * Look the address up in the city/county's own parcel table: recorded lot
 * area, and where the table carries them, the zoning district and max
 * residential FAR. Requires a house-number match — no match, no guess.
 */
export async function parcelAtAddress(
  city: string,
  state: string,
  streetAddress: string,
  lat?: number,
  lng?: number,
): Promise<ParcelInfo | null> {
  const src = PARCEL_SOURCES.find((s) => s.match(city, state));
  if (!src) return null;
  if (src.kind === "arcgis") {
    if (lat == null || lng == null) return null;
    const hit = await arcgisParcelAtPoint(src.url, lat, lng);
    return hit ? { ...hit, source: src.source } : null;
  }
  try {
    const q = streetQuery(streetAddress);
    const res = await fetch(`${src.url}?$q=${encodeURIComponent(q)}&$limit=10`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows) || !rows.length) return null;
    const houseNo = q.split(/\s+/)[0].toUpperCase();
    const addressKeyOf = (row: Record<string, unknown>) =>
      src.fields?.address ?? Object.keys(row).find((k) => /address/i.test(k) && typeof row[k] === "string");
    const pick = rows.find((r) => {
      const ak = addressKeyOf(r);
      return ak && typeof r[ak] === "string" && (r[ak] as string).trim().toUpperCase().startsWith(houseNo + " ");
    });
    if (!pick) return null;
    let lotSqft: number | undefined;
    let zone: string | undefined;
    let residFar: number | undefined;
    let lotFront: number | undefined;
    let lotDepth: number | undefined;
    if (src.fields) {
      lotSqft = saneLot(num(pick[src.fields.lot]));
      if (src.fields.zone) {
        const z = pick[src.fields.zone];
        if (typeof z === "string" && z.trim()) zone = z.trim();
      }
      if (src.fields.residFar) residFar = num(pick[src.fields.residFar]);
      if (src.fields.front) lotFront = saneDim(num(pick[src.fields.front]));
      if (src.fields.depth) lotDepth = saneDim(num(pick[src.fields.depth]));
    } else {
      for (const [k, v] of Object.entries(pick)) {
        if (/(^|_)(land|lot)_?(sq_?ft|sf|size|area)/i.test(k) && !/val|price|tax|assess|code|flag/i.test(k)) {
          const n = saneLot(num(v));
          if (n) { lotSqft = n; break; }
        }
      }
      zone = pickZoneValue(pick) ?? undefined;
    }
    if (lotSqft == null && !zone && residFar == null) return null;
    return { lotSqft, zone, residFar, lotFront, lotDepth, source: src.source };
  } catch {
    return null;
  }
}

export interface Envelope {
  units: number | null;
  buildableSqft: number | null;
  binding: string;
  /** Ground-floor footprint after setbacks (sf) — when width/depth are known. */
  footprintSqft: number | null;
}

/** What the numbers allow on a given lot — every assumption named. */
export function envelope(
  lotSqft: number,
  r: {
    far?: number; coverage?: number; stories?: number; maxUnits?: number; minLotPerUnitSqft?: number;
    setbackFt?: { front: number; side: number; rear: number };
  },
  dims?: { widthFt?: number; depthFt?: number },
): Envelope {
  if (!lotSqft || lotSqft <= 0) return { units: null, buildableSqft: null, binding: "", footprintSqft: null };
  const byFar = r.far ? r.far * lotSqft : Infinity;
  const byCoverage = r.coverage && r.stories ? r.coverage * lotSqft * r.stories : Infinity;
  // Setback footprint: what's left of the lot rectangle after the required
  // front/side/rear yards, times the allowed stories.
  let footprint: number | null = null;
  let byFootprint = Infinity;
  if (r.setbackFt && dims?.widthFt && dims?.depthFt && dims.widthFt > 0 && dims.depthFt > 0) {
    const w = Math.max(0, dims.widthFt - 2 * r.setbackFt.side);
    const d = Math.max(0, dims.depthFt - r.setbackFt.front - r.setbackFt.rear);
    footprint = Math.round(w * d);
    if (r.stories) byFootprint = footprint * r.stories;
  }
  const buildable = Math.min(byFar, byCoverage, byFootprint);
  const binding =
    buildable === Infinity ? ""
    : buildable === byFootprint ? "setback footprint × stories"
    : byFar <= byCoverage ? "FAR"
    : "coverage × stories";
  let units: number | null = null;
  if (r.minLotPerUnitSqft) units = Math.max(1, Math.floor(lotSqft / r.minLotPerUnitSqft));
  if (r.maxUnits != null) units = units == null ? r.maxUnits : Math.min(units, r.maxUnits);
  return {
    units,
    buildableSqft: buildable === Infinity ? null : Math.round(buildable),
    binding,
    footprintSqft: footprint,
  };
}
