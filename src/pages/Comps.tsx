import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip as RcTooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { compsProvider, type CompRecord } from "@/providers/comps";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { geocode } from "@/lib/geocode";
import { Download, ArrowRight, Search, Sparkles, MapPin } from "lucide-react";

function percentile(xs: number[], p: number) {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export default function Comps() {
  const [address, setAddress] = React.useState("Austin, TX");
  const [radius, setRadius] = React.useState(3);
  const [comps, setComps] = React.useState<CompRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [center, setCenter] = React.useState<{ lat: number; lng: number; label: string } | null>(null);

  const runSearch = React.useCallback(async () => {
    setLoading(true);
    try {
      const geo = await geocode(address);
      if (!geo) {
        toast.error("Couldn't geocode that address. Try a metro name.");
        setLoading(false);
        return;
      }
      setCenter({ lat: geo.lat, lng: geo.lng, label: geo.name });
      const result = await compsProvider.search({
        center: { lat: geo.lat, lng: geo.lng },
        radiusMi: radius,
        monthsBack: 12,
        newConstructionOnly: true,
      });
      setComps(result);
    } catch (e) {
      toast.error("Comps search failed.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [address, radius]);

  React.useEffect(() => { runSearch(); /* run on mount only */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ppsfValues = comps.map((c) => c.pricePerSqft).filter((v): v is number => v != null);
  const stats = {
    n: comps.length,
    medianPpsf: Math.round(percentile(ppsfValues, 0.5)),
    p25Ppsf: Math.round(percentile(ppsfValues, 0.25)),
    p75Ppsf: Math.round(percentile(ppsfValues, 0.75)),
    medianSold: Math.round(percentile(comps.map((c) => c.soldPrice), 0.5)),
    medianDom: Math.round(percentile(comps.map((c) => c.daysOnMarket ?? 0).filter(Boolean), 0.5)),
    soldToList:
      comps.filter((c) => c.listPrice).length > 0
        ? comps.reduce((s, c) => s + (c.listPrice ? c.soldPrice / c.listPrice : 0), 0) /
          comps.filter((c) => c.listPrice).length
        : 1,
  };

  const exportCSV = () => {
    const header = ["address", "sqft", "beds", "baths", "sold_price", "$/sqft", "sold_date", "dom", "source"];
    const rows = comps.map((c) => [
      c.address, c.sqft ?? "", c.beds ?? "", c.baths ?? "", c.soldPrice,
      c.pricePerSqft ?? "", c.soldDate, c.daysOnMarket ?? "", c.source,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pencil-comps-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendToAnalyzer = () => {
    const params = new URLSearchParams({
      arv: String(stats.medianSold),
      costPerSqft: String(Math.round(stats.medianPpsf * 0.55)), // rough construction-cost heuristic
      address,
    });
    window.location.href = `/deal-analyzer?${params.toString()}`;
  };

  return (
    <div className="container py-10">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="gold-rule" />
          <h1 className="mt-3 font-display text-4xl">Comps Engine</h1>
          <p className="mt-1 text-muted-foreground max-w-xl">
            Brand-new construction sold in the last 12 months. Percentile bands,
            $/sqft scatter, and a one-click send to the Deal Analyzer.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={comps.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="gold" size="sm" onClick={sendToAnalyzer} disabled={comps.length === 0}>
            <ArrowRight className="h-4 w-4" /> Send to Analyzer
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 grid md:grid-cols-[1fr_140px_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="addr">Search area</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="addr"
                className="pl-9"
                placeholder="2421 E 5th St, Austin, TX or Nashville, TN"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rad">Radius (mi)</Label>
            <Input id="rad" type="number" min={0.25} step={0.25} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          </div>
          <Button variant="default" onClick={runSearch} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </Button>
        </CardContent>
        {center && (
          <div className="px-5 pb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 text-gold" />
            <span>
              Centered on <span className="text-foreground font-medium">{center.label}</span>
              {" · "}
              {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
            </span>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="Comps" value={fmtNumber(stats.n)} />
        <StatCard label="Median sold" value={fmtMoney(stats.medianSold)} />
        <StatCard label="Median $/sf" value={`$${stats.medianPpsf}`} accent />
        <StatCard label="25th–75th $/sf" value={`$${stats.p25Ppsf}–$${stats.p75Ppsf}`} />
        <StatCard label="Median DOM" value={`${stats.medianDom} days`} />
        <StatCard label="Sold/list" value={`${(stats.soldToList * 100).toFixed(1)}%`} />
      </div>

      {/* Scatter */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>$/sqft × sqft</CardTitle>
          <CardDescription>
            Dashed line is the median; gold band is the interquartile range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[360px] w-full">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 12, right: 18, bottom: 6, left: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 15% 88%)" />
                <XAxis type="number" dataKey="sqft" name="sqft" tick={{ fontSize: 12 }} label={{ value: "Built sqft", position: "insideBottom", offset: -2, fontSize: 12 }} />
                <YAxis type="number" dataKey="pricePerSqft" name="$/sqft" tick={{ fontSize: 12 }} label={{ value: "$/sqft", angle: -90, position: "insideLeft", fontSize: 12 }} />
                <ReferenceLine y={stats.p25Ppsf} stroke="hsl(38 48% 52%)" strokeDasharray="2 4" />
                <ReferenceLine y={stats.p75Ppsf} stroke="hsl(38 48% 52%)" strokeDasharray="2 4" />
                <ReferenceLine y={stats.medianPpsf} stroke="hsl(25 22% 25%)" strokeDasharray="4 4" />
                <RcTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ background: "hsl(36 40% 99%)", border: "1px solid hsl(30 15% 86%)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n: string) => [n === "$/sqft" ? `$${v}` : fmtNumber(v), n]}
                />
                <Scatter data={comps} fill="hsl(38 48% 52%)" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Comparable sales</CardTitle>
            <CardDescription>Newly built homes sold in the last 12 months.</CardDescription>
          </div>
          <Badge variant="outline"><Sparkles className="h-3 w-3 text-gold" /> ATTOM</Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Address</th>
                <th className="py-2 px-3 font-medium">Beds/Bath</th>
                <th className="py-2 px-3 font-medium">Sqft</th>
                <th className="py-2 px-3 font-medium">Sold</th>
                <th className="py-2 px-3 font-medium">$/sqft</th>
                <th className="py-2 px-3 font-medium">DOM</th>
                <th className="py-2 pl-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.id} className="border-b border-border/60 hover:bg-secondary/40">
                  <td className="py-2.5 pr-3 font-medium">{c.address}</td>
                  <td className="py-2.5 px-3">{c.beds}/{c.baths}</td>
                  <td className="py-2.5 px-3 tabular-nums">{fmtNumber(c.sqft)}</td>
                  <td className="py-2.5 px-3 tabular-nums">{fmtMoney(c.soldPrice)}</td>
                  <td className="py-2.5 px-3 tabular-nums text-gold font-medium">${c.pricePerSqft}</td>
                  <td className="py-2.5 px-3 tabular-nums">{c.daysOnMarket}</td>
                  <td className="py-2.5 pl-3 text-muted-foreground">{c.soldDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {comps.length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-10 text-sm">
              No comps yet. Try widening the radius or a different area.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        <Link to="/deal-analyzer" className="text-gold hover:underline">Click here</Link>{" "}
        to underwrite a deal in this area with these comps pre-filled.
      </p>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="stat-label">{label}</div>
        <div className={`mt-1 font-display text-2xl ${accent ? "text-gold" : "text-foreground"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
