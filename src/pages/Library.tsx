import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/integrations/supabase/client";
import { fmtMoney, fmtPct } from "@/lib/format";
import type { DealInputs, DealResults } from "@/lib/calc/deal";
import { GitCompare, Trash2, FileText } from "lucide-react";

interface SavedDeal {
  id: string;
  name: string;
  address: string | null;
  inputs: DealInputs;
  results: DealResults;
  created_at: string;
  updated_at: string;
}

export default function Library() {
  const { user } = useAuth();
  const [deals, setDeals] = React.useState<SavedDeal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) {
      setLoading(false);
      return;
    }
    sb.from("deals")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setDeals((data ?? []) as unknown as SavedDeal[]);
        setLoading(false);
      });
  }, [user]);

  const toggle = (id: string) =>
    setSelected((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id);
      return next;
    });

  const remove = async (id: string) => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("deals").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setDeals((p) => p.filter((d) => d.id !== id));
  };

  const compareSet = deals.filter((d) => selected.has(d.id));

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="gold-rule" />
          <h1 className="mt-3 font-display text-4xl">Pro Forma Library</h1>
          <p className="mt-1 text-muted-foreground">Saved deals, versioned and comparable.</p>
        </div>
        <Button variant="gold" size="sm" asChild>
          <Link to="/deal-analyzer">New deal</Link>
        </Button>
      </div>

      {compareSet.length === 2 && (
        <Card className="mb-6 border-gold">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-gold" /> Comparing
            </CardTitle>
            <CardDescription>Side-by-side of the two selected deals.</CardDescription>
          </CardHeader>
          <CardContent>
            <Compare a={compareSet[0]} b={compareSet[1]} />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : deals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="mt-3 font-display text-2xl">No saved deals yet</p>
            <p className="mt-1 text-muted-foreground">
              Underwrite a deal in the Analyzer, then hit save.
            </p>
            <Button asChild variant="gold" className="mt-5">
              <Link to="/deal-analyzer">Open Deal Analyzer</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((d) => (
            <Card key={d.id} className={selected.has(d.id) ? "border-gold ring-2 ring-gold/30" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{d.name}</CardTitle>
                  <Badge variant={(d.results?.projectedProfit ?? 0) > 0 ? "gold" : "destructive"}>
                    {fmtPct(d.results?.profitMargin ?? 0)}
                  </Badge>
                </div>
                <CardDescription>{d.address ?? "—"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="All-in" value={fmtMoney(d.results?.allInCost)} />
                  <Stat label="ARV" value={fmtMoney(d.inputs?.arv)} />
                  <Stat label="Profit" value={fmtMoney(d.results?.projectedProfit)} accent />
                  <Stat label="Cash left" value={fmtMoney(d.results?.cashLeftInDeal)} />
                </div>
                <Separator className="my-4" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggle(d.id)}>
                    {selected.has(d.id) ? "Selected" : "Compare"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(d.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-2.5">
      <div className="stat-label">{label}</div>
      <div className={`font-display text-lg mt-0.5 ${accent ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}

function Compare({ a, b }: { a: SavedDeal; b: SavedDeal }) {
  const rows: Array<[string, (d: SavedDeal) => string]> = [
    ["All-in cost", (d) => fmtMoney(d.results?.allInCost)],
    ["ARV", (d) => fmtMoney(d.inputs?.arv)],
    ["Projected profit", (d) => fmtMoney(d.results?.projectedProfit)],
    ["Profit margin", (d) => fmtPct(d.results?.profitMargin)],
    ["Cash required", (d) => fmtMoney(d.results?.cashRequired)],
    ["Cash left in deal", (d) => fmtMoney(d.results?.cashLeftInDeal)],
    ["Annual cash flow", (d) => fmtMoney(d.results?.cashFlow)],
    ["Cap rate", (d) => fmtPct(d.results?.capRate)],
    ["Cash-on-cash", (d) => fmtPct(d.results?.cashOnCash)],
  ];
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-4 text-sm">
      <div />
      <div className="font-display text-base">{a.name}</div>
      <div className="font-display text-base">{b.name}</div>
      {rows.map(([label, get]) => (
        <React.Fragment key={label}>
          <div className="text-muted-foreground py-1.5">{label}</div>
          <div className="py-1.5 tabular-nums">{get(a)}</div>
          <div className="py-1.5 tabular-nums">{get(b)}</div>
        </React.Fragment>
      ))}
    </div>
  );
}
