import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { NumericField } from "@/components/MoneyInput";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Printer, Save, Sparkles, Library, Trash2,
} from "lucide-react";
import { calcDeal, defaultDeal, type DealInputs, type DealResults } from "@/lib/calc/deal";
import { fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { getSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const LS_KEY = "pencil:dealAnalyzer:draft";

export default function DealAnalyzer() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [inputs, setInputs] = React.useState<DealInputs>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) return { ...defaultDeal, ...JSON.parse(stored) };
    } catch {}
    return defaultDeal;
  });

  // Build-to-sell (single family / for-sale) vs build-to-rent (refi + hold).
  // Sell mode hides the Refi and Rental steps — they don't apply to a flip.
  const [strategy, setStrategy] = React.useState<"sell" | "rent">("rent");

  React.useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(inputs));
  }, [inputs]);

  // Pre-fill from the Map ("Underwrite this deal") or Comps via querystring.
  React.useEffect(() => {
    const arv = Number(params.get("arv"));
    const costPerSqft = Number(params.get("costPerSqft"));
    const totalSqft = Number(params.get("totalSqft"));
    const address = params.get("address") ?? undefined;
    const productType = params.get("productType");
    if (Number.isFinite(arv) && arv > 0) setInputs((p) => ({ ...p, arv }));
    if (Number.isFinite(costPerSqft) && costPerSqft > 0) setInputs((p) => ({ ...p, costPerSqft }));
    if (Number.isFinite(totalSqft) && totalSqft > 0) setInputs((p) => ({ ...p, totalSqft }));
    if (address) setInputs((p) => ({ ...p, address }));
    // Single-family → build-to-sell (no refi/rental; selling costs apply).
    if (productType === "SFH") {
      setStrategy("sell");
      setInputs((p) => ({ ...p, refiEnabled: false, applySellingCosts: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseStrategy = (s: "sell" | "rent") => {
    setStrategy(s);
    setInputs((p) => ({ ...p, refiEnabled: s === "rent", applySellingCosts: s === "sell" }));
  };

  const r = React.useMemo(() => calcDeal(inputs), [inputs]);
  const set = <K extends keyof DealInputs>(k: K, v: DealInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    const sb = getSupabase();
    if (!sb || !user) {
      toast.error("Sign in to save deals.");
      return;
    }
    const name = inputs.address || `Deal ${new Date().toLocaleDateString()}`;
    const { error } = await sb.from("deals").insert({
      user_id: user.id,
      name,
      address: inputs.address ?? null,
      inputs: inputs as unknown as Record<string, unknown>,
      results: r as unknown as Record<string, unknown>,
    });
    if (error) toast.error(`Save failed: ${error.message}`);
    else toast.success(`Saved "${name}" to your Library.`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="container py-10 print:py-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 print:hidden">
        <div>
          <div className="gold-rule" />
          <h1 className="mt-3 font-display text-4xl">Deal Analyzer</h1>
          <p className="mt-1 text-muted-foreground max-w-xl">
            The proven Developer Launch underwriting model — now live and
            saveable. Toggle refi and partner modes as needed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/library"><Library className="h-4 w-4" /> Library</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
          <AINotesButton inputs={inputs} results={r} />
          <Button variant="gold" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4" /> Save deal
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setInputs(defaultDeal)}>
            <Trash2 className="h-4 w-4" /> Reset
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
        {/* Inputs */}
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>Step through each section. Results update live.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Strategy: build-to-sell hides Refi + Rental (a flip has neither). */}
            <div className="mb-5 flex items-center gap-2 rounded-md border border-border bg-secondary/40 p-1">
              <button
                onClick={() => chooseStrategy("sell")}
                className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                  strategy === "sell" ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Build to sell
              </button>
              <button
                onClick={() => chooseStrategy("rent")}
                className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                  strategy === "rent" ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Build to rent (refi)
              </button>
            </div>
            <Tabs defaultValue="step1">
              <TabsList className={`grid w-full ${strategy === "rent" ? "grid-cols-4" : "grid-cols-2"}`}>
                <TabsTrigger value="step1">Costs</TabsTrigger>
                {strategy === "rent" && <TabsTrigger value="step2">Refi</TabsTrigger>}
                <TabsTrigger value="step3">Partner</TabsTrigger>
                {strategy === "rent" && <TabsTrigger value="step4">Rental</TabsTrigger>}
              </TabsList>

              <TabsContent value="step1" className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="address">Project address</Label>
                  <Input
                    id="address"
                    placeholder="123 Main St, Austin, TX"
                    value={inputs.address ?? ""}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <NumericField label="Land cost" value={inputs.landCost} onChange={(v) => set("landCost", v)} prefix="$" />
                  <NumericField label="Cost / sqft" value={inputs.costPerSqft} onChange={(v) => set("costPerSqft", v)} prefix="$" />
                  <NumericField label="Total sqft" value={inputs.totalSqft} onChange={(v) => set("totalSqft", v)} suffix="sf" />
                  <NumericField label="Closing costs" value={inputs.closingCostsPct} onChange={(v) => set("closingCostsPct", v)} suffix="%" percent />
                  <NumericField label="Lender fees" value={inputs.lenderFeesPct} onChange={(v) => set("lenderFeesPct", v)} suffix="%" percent />
                  <NumericField label="Construction rate" value={inputs.constructionRate} onChange={(v) => set("constructionRate", v)} suffix="%" percent />
                  <NumericField label="Months to build" value={inputs.monthsToBuild} onChange={(v) => set("monthsToBuild", v)} suffix="mo" />
                  <NumericField label="LTC" value={inputs.ltcPct} onChange={(v) => set("ltcPct", v)} suffix="%" percent />
                  <NumericField label={strategy === "sell" ? "Sale price (ARV)" : "ARV (after-repair value)"} value={inputs.arv} onChange={(v) => set("arv", v)} prefix="$" className="sm:col-span-2" />
                </div>
                {strategy === "sell" && (
                  <div className="grid sm:grid-cols-2 gap-4 rounded-md border border-border bg-secondary/30 p-4">
                    <div className="sm:col-span-2 stat-label">Cost of selling</div>
                    <NumericField label="Realtor commission" value={inputs.salesCommissionPct} onChange={(v) => set("salesCommissionPct", v)} suffix="%" percent hint="Total agent commission on the sale price." />
                    <NumericField label="Sale closing" value={inputs.saleClosingPct} onChange={(v) => set("saleClosingPct", v)} suffix="%" percent hint="Seller-side title, escrow, transfer tax." />
                  </div>
                )}
              </TabsContent>

              {strategy === "rent" && (
                <TabsContent value="step2" className="space-y-5">
                  <ToggleRow label="Refi after build" checked={inputs.refiEnabled} onChange={(v) => set("refiEnabled", v)} />
                  <div className={`grid sm:grid-cols-2 gap-4 ${inputs.refiEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                    <NumericField label="Takeout LTV" value={inputs.refiLtvPct} onChange={(v) => set("refiLtvPct", v)} suffix="%" percent />
                    <NumericField label="Refi closing" value={inputs.refiClosingPct} onChange={(v) => set("refiClosingPct", v)} suffix="%" percent />
                    <NumericField label="Refi rate" value={inputs.refiRate} onChange={(v) => set("refiRate", v)} suffix="%" percent />
                    <NumericField label="Loan term" value={inputs.refiTermYears} onChange={(v) => set("refiTermYears", v)} suffix="yr" />
                    <NumericField label="Amortization" value={inputs.amortYears} onChange={(v) => set("amortYears", v)} suffix="yr" className="sm:col-span-2" />
                  </div>
                </TabsContent>
              )}

              <TabsContent value="step3" className="space-y-5">
                <ToggleRow label="Capital partner" checked={inputs.partnerEnabled} onChange={(v) => set("partnerEnabled", v)} />
                <div className={`grid sm:grid-cols-2 gap-4 ${inputs.partnerEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                  <NumericField
                    label="Sponsor equity share"
                    value={inputs.sponsorEquityPct}
                    onChange={(v) => set("sponsorEquityPct", v)}
                    suffix="%"
                    percent
                    hint="Your share of the profit after capital partner is made whole."
                  />
                </div>
              </TabsContent>

              {strategy === "rent" && (
                <TabsContent value="step4" className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <NumericField label="Monthly rent" value={inputs.monthlyRent} onChange={(v) => set("monthlyRent", v)} prefix="$" />
                    <NumericField label="Vacancy" value={inputs.vacancyPct} onChange={(v) => set("vacancyPct", v)} suffix="%" percent />
                    <NumericField label="Taxes / mo" value={inputs.taxesMo} onChange={(v) => set("taxesMo", v)} prefix="$" />
                    <NumericField label="Insurance / mo" value={inputs.insuranceMo} onChange={(v) => set("insuranceMo", v)} prefix="$" />
                    <NumericField label="Maintenance / mo" value={inputs.maintenanceMo} onChange={(v) => set("maintenanceMo", v)} prefix="$" />
                    <NumericField label="Management" value={inputs.managementPct} onChange={(v) => set("managementPct", v)} suffix="%" percent />
                    <NumericField label="Other / mo" value={inputs.otherMo} onChange={(v) => set("otherMo", v)} prefix="$" />
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>

        {/* Results */}
        <Results inputs={inputs} r={r} strategy={strategy} />
      </div>
    </div>
  );
}

function ToggleRow({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Results({ inputs, r, strategy }: { inputs: DealInputs; r: DealResults; strategy: "sell" | "rent" }) {
  const showRent = strategy === "rent";
  return (
    <div className="space-y-5 lg:sticky lg:top-20 self-start">
      {/* Hero stats */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Live results</CardTitle>
            <Badge variant={r.projectedProfit > 0 ? "gold" : "destructive"}>
              {r.profitMargin > 0 ? fmtPct(r.profitMargin) : "Negative"} margin
            </Badge>
          </div>
          <CardDescription>
            {inputs.address || "Untitled deal"} · {inputs.totalSqft.toLocaleString()} sf
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Stat label="All-in cost" value={fmtMoney(r.allInCost)} big />
          <Stat label="ARV" value={fmtMoney(inputs.arv)} big />
          <Stat label="Cash required" value={fmtMoney(r.cashRequired)} />
          <Stat label="Projected profit" value={fmtMoney(r.projectedProfit)} accent />
        </CardContent>
      </Card>

      {/* Construction block */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Construction</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Row label="Hard construction" value={fmtMoney(r.hardConstruction)} />
          <Row label="Closing costs" value={fmtMoney(r.closingCosts)} />
          <Row label="Construction loan" value={fmtMoney(r.constructionLoan)} />
          <Row label="Lender fees" value={fmtMoney(r.lenderFees)} />
          <Row label="Monthly carry" value={fmtMoney(r.monthlyCarry)} />
          <Row label="Total carry" value={fmtMoney(r.totalCarry)} />
        </CardContent>
      </Card>

      {/* Sale summary (build-to-sell) */}
      {!showRent && (
        <Card>
          <CardHeader><CardTitle className="text-lg">On sale</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row label="Sale price (ARV)" value={fmtMoney(inputs.arv)} />
            <Row label="Selling costs" value={fmtMoney(-r.sellingCosts)} />
            <Row label="Net sale proceeds" value={fmtMoney(r.netSaleProceeds)} />
            <Row label="All-in cost" value={fmtMoney(-r.allInCost)} />
            <Separator className="my-2" />
            <Row label="Projected profit" value={fmtMoney(r.projectedProfit)} accent />
            <Row label="Profit margin" value={fmtPct(r.profitMargin)} />
            <Row label="Return on cash" value={fmtPct(r.cashRequired > 0 ? r.projectedProfit / r.cashRequired : 0)} accent />
          </CardContent>
        </Card>
      )}

      {/* Refi block */}
      {showRent && inputs.refiEnabled && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Refinance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row label="Refi loan" value={fmtMoney(r.refiLoan)} />
            <Row label="Refi closing" value={fmtMoney(r.refiClosing)} />
            <Row label="Net cash at refi" value={fmtMoney(r.netCashAtRefi)} />
            <Row label="Original cash back" value={fmtMoney(r.originalCashBack)} />
            <Row label="Equity created" value={fmtMoney(r.equityCreated)} accent />
            <Row label="New P&I (monthly)" value={fmtMoney(r.newPI)} />
            <Row label="Cash left in deal" value={fmtMoney(r.cashLeftInDeal)} />
          </CardContent>
        </Card>
      )}

      {/* Rental block */}
      {showRent && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Rental operating</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row label="Gross rent (annual)" value={fmtMoney(r.grossRent)} />
            <Row label="Vacancy loss" value={fmtMoney(-r.vacancyLoss)} />
            <Row label="EGI" value={fmtMoney(r.egi)} />
            <Row label="Opex" value={fmtMoney(-r.opex)} />
            <Row label="NOI" value={fmtMoney(r.noi)} accent />
            {inputs.refiEnabled && <Row label="Debt service" value={fmtMoney(-r.debtService)} />}
            {inputs.refiEnabled && <Row label="Annual cash flow" value={fmtMoney(r.cashFlow)} accent />}
            <Separator className="my-2" />
            <Row label="Cap rate" value={fmtPct(r.capRate)} />
            {inputs.refiEnabled && <Row label="Cash-on-cash" value={fmtPct(r.cashOnCash)} />}
            {inputs.refiEnabled && <Row label="DSCR" value={fmtRatio(r.dscr)} />}
          </CardContent>
        </Card>
      )}

      {inputs.partnerEnabled && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Partner split</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Row label="Sponsor profit share" value={fmtMoney(r.sponsorProfitShare)} />
            <Row label="Investor profit share" value={fmtMoney(r.investorProfitShare)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, big, accent }: { label: string; value: string; big?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <div className="stat-label">{label}</div>
      <div className={`mt-1 font-display ${big ? "text-3xl" : "text-2xl"} ${accent ? "text-gold" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${accent ? "text-gold" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function AINotesButton({ inputs, results }: { inputs: DealInputs; results: DealResults }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<string>("");

  const run = async () => {
    setLoading(true);
    setSummary("");
    try {
      const sb = getSupabase();
      if (!sb) {
        // Local fallback so the button is never a dead-end.
        setSummary(localSummary(inputs, results));
        return;
      }
      const { data, error } = await sb.functions.invoke("deal-summary", {
        body: { inputs, results },
      });
      if (error) throw error;
      setSummary(((data as { summary?: string })?.summary ?? "").trim() || localSummary(inputs, results));
    } catch (e) {
      console.error(e);
      setSummary(localSummary(inputs, results));
      toast.message("Used local summary (AI gateway not configured).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && !summary) run(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="h-4 w-4 text-gold" /> AI Notes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deal memo</DialogTitle>
          <DialogDescription>
            One-page summary suitable for a capital partner or lender.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-sans">
          {loading ? "Drafting…" : summary}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={run} disabled={loading}>
            Regenerate
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(summary);
              toast.success("Memo copied to clipboard.");
            }}
          >
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 flex items-center justify-end gap-2">{children}</div>;
}

function localSummary(d: DealInputs, r: DealResults): string {
  return [
    `${d.address || "Untitled deal"} · ${d.totalSqft.toLocaleString()} sf ground-up.`,
    "",
    `All-in cost: ${fmtMoney(r.allInCost)} against ARV of ${fmtMoney(d.arv)}.`,
    `Projected profit ${fmtMoney(r.projectedProfit)} (${fmtPct(r.profitMargin)} margin).`,
    d.refiEnabled
      ? `Refi at ${fmtPct(d.refiLtvPct)} LTV pulls ${fmtMoney(r.netCashAtRefi)} back, leaving ${fmtMoney(r.cashLeftInDeal)} in the deal. Cash-on-cash ${fmtPct(r.cashOnCash)}, DSCR ${fmtRatio(r.dscr)}.`
      : `No refi modeled. Cash basis ${fmtMoney(r.cashRequired)}.`,
    `Rental: ${fmtMoney(r.noi)} NOI on ${fmtMoney(r.grossRent)} gross at ${fmtPct(d.vacancyPct)} vacancy — cap rate ${fmtPct(r.capRate)}.`,
    d.partnerEnabled
      ? `Partner structure: sponsor takes ${fmtPct(d.sponsorEquityPct)} of profit (${fmtMoney(r.sponsorProfitShare)}).`
      : "",
  ].filter(Boolean).join("\n");
}
