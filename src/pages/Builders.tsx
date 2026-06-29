import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, ExternalLink } from "lucide-react";

interface Builder {
  id: string;
  name: string;
  metro: string;
  projects: number;
  productTypes: string[];
  priceBand: string;
  licenseNo: string;
  recent: string[];
  contactUrl: string;
}

const DEMO_BUILDERS: Builder[] = [
  { id: "1", name: "Lariat Homes", metro: "Austin", projects: 12, productTypes: ["Fourplex", "SFH"], priceBand: "$200–$240/sf", licenseNo: "TX-RBH-19422", recent: ["2421 E 5th St", "3814 S Lamar"], contactUrl: "https://example.com" },
  { id: "2", name: "Cedar & Pine LLC", metro: "Austin", projects: 8, productTypes: ["Duplex", "SFH"], priceBand: "$215–$255/sf", licenseNo: "TX-RBH-22118", recent: ["5402 N Burnet"], contactUrl: "https://example.com" },
  { id: "3", name: "Brick Stone Build", metro: "Austin", projects: 6, productTypes: ["Small multi"], priceBand: "$235–$280/sf", licenseNo: "TX-RBH-31044", recent: ["115 W Mary"], contactUrl: "https://example.com" },
  { id: "4", name: "Halo Construction", metro: "Dallas", projects: 14, productTypes: ["Fourplex"], priceBand: "$195–$230/sf", licenseNo: "TX-RBH-40291", recent: ["920 Live Oak"], contactUrl: "https://example.com" },
  { id: "5", name: "Foundry Custom Homes", metro: "Nashville", projects: 9, productTypes: ["SFH", "Infill"], priceBand: "$225–$270/sf", licenseNo: "TN-GC-78122", recent: ["1407 Holly St"], contactUrl: "https://example.com" },
  { id: "6", name: "Vesta Vertical", metro: "Denver", projects: 11, productTypes: ["Small multi", "Fourplex"], priceBand: "$240–$290/sf", licenseNo: "CO-GC-12998", recent: ["3318 Kalamath"], contactUrl: "https://example.com" },
];

export default function Builders() {
  const [metro, setMetro] = React.useState("All metros");
  const [q, setQ] = React.useState("");

  const metros = ["All metros", ...Array.from(new Set(DEMO_BUILDERS.map((b) => b.metro)))];

  const filtered = DEMO_BUILDERS.filter(
    (b) =>
      (metro === "All metros" || b.metro === metro) &&
      (q === "" || b.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="container py-10">
      <div className="mb-6">
        <div className="gold-rule" />
        <h1 className="mt-3 font-display text-4xl">Builder Directory</h1>
        <p className="mt-1 text-muted-foreground max-w-xl">
          Vetted GCs and trades by metro. Past projects, license numbers, and a
          one-click quote request.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 grid md:grid-cols-[1fr_240px] gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="b-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="b-search" className="pl-9" placeholder="Builder name" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="metro">Metro</Label>
            <select
              id="metro"
              value={metro}
              onChange={(e) => setMetro(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {metros.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((b) => (
          <Card key={b.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-xl">{b.name}</CardTitle>
                <Badge variant="gold">{b.projects} active</Badge>
              </div>
              <CardDescription>{b.metro} · License {b.licenseNo}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex flex-wrap gap-1.5">
                {b.productTypes.map((p) => (
                  <Badge key={p} variant="secondary">{p}</Badge>
                ))}
              </div>
              <div className="mt-4 stat-label">Typical price band</div>
              <div className="font-display text-lg text-foreground">{b.priceBand}</div>

              <div className="mt-4 stat-label">Recent projects</div>
              <ul className="text-sm space-y-0.5">
                {b.recent.map((r) => <li key={r} className="text-foreground/90">{r}</li>)}
              </ul>

              <div className="mt-auto pt-5 flex gap-2">
                <Button
                  variant="gold"
                  size="sm"
                  className="flex-1"
                  onClick={() => toast.success(`Quote request sent to ${b.name}.`)}
                >
                  <Mail className="h-4 w-4" /> Request quote
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={b.contactUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
