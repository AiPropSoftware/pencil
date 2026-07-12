import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  Map as MapIcon, Calculator, Landmark, ScrollText,
  ArrowRight, Check, Sparkles,
} from "lucide-react";

// Every number on this page is real and verifiable in the product.
const FEATURES = [
  {
    icon: MapIcon,
    title: "Live permit map",
    body: "Every pin is a real building permit pulled straight from city public records — exact addresses from each city's own GIS, real Street View photos, self-updating every five minutes. Search any city and Pencil hunts its permit datasets on demand.",
  },
  {
    icon: Calculator,
    title: "Underwrite in seconds",
    body: "Tap any property and run the numbers: your land price, your sell $/sf, build costs seeded from real permit valuations. Financing modeled like an actual construction loan — 85% LTC, current hard-money rates, points, and carry.",
  },
  {
    icon: Landmark,
    title: "Fund it",
    body: "A curated directory of national and regional hard-money lenders — Kiavi, Lima One, RCN, Builders Capital and more — matched to the property's state, with ground-up construction specialists ranked first.",
  },
  {
    icon: ScrollText,
    title: "One click to city hall",
    body: "Permit application portals, zoning codes, and parcel GIS maps for 40+ major metros — the official city and county sites, one click from any property.",
  },
];

const PROOF = [
  ["8", "cities streaming live permits"],
  ["2,700+", "real permits on the map today"],
  ["56", "metros with verified market data"],
];

const BULLETS = [
  "Every pin is a real permit from public records",
  "Honest math — your numbers, real loan modeling",
  "Hard-money lenders matched to your state",
  "Official permit, zoning & GIS portals built in",
];

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/map" replace />;

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="container pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <Badge variant="gold" className="rounded-full">
              <Sparkles className="mr-1.5 h-3 w-3" /> Live public-record data
            </Badge>
            <h1 className="mt-5 font-display text-5xl sm:text-6xl lg:text-[68px] leading-[1.05] tracking-tight">
              Investors become <em className="text-gold not-italic font-display">developers</em>.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              Pencil puts every new-construction permit in America's biggest
              cities on one map — real records, real addresses — then lets you
              underwrite and fund the deal without leaving the page.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" variant="gold" asChild>
                <Link to="/sign-up">
                  Sign up free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/map">Explore the live map</Link>
              </Button>
            </div>
            <ul className="mt-10 grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-gold mt-0.5 flex-none" />
                  <span className="text-foreground/90">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      <div className="section-divider" />

      {/* Proof — real, current product numbers */}
      <section className="container py-14">
        <div className="grid sm:grid-cols-3 gap-10">
          {PROOF.map(([value, label]) => (
            <div key={label} className="text-center sm:text-left">
              <div className="font-display text-4xl text-foreground">{value}</div>
              <div className="mt-2 stat-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* Features */}
      <section className="container py-24" id="features">
        <div className="max-w-2xl">
          <div className="gold-rule" />
          <h2 className="mt-5 font-display text-4xl sm:text-5xl tracking-tight">
            One map. The whole deal.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Ground-up deals live or die on the same questions: what's being
            built here, does the math work, and who funds it. Pencil answers
            all three on a single page.
          </p>
        </div>
        <div className="mt-14 grid md:grid-cols-2 gap-6">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="border-border/80 hover:shadow-elevated transition-shadow">
              <CardContent className="p-7">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-gold-muted text-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-2xl">{title}</h3>
                </div>
                <p className="mt-4 text-muted-foreground leading-relaxed">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* How */}
      <section className="container py-24">
        <div className="grid lg:grid-cols-3 gap-12">
          {[
            { n: "01", t: "Scout", b: "Search any city. Real permits appear at their exact addresses with Street View, contractor of record, and issue dates from the public file." },
            { n: "02", t: "Underwrite", b: "Enter your land price and sell $/sf. Pencil returns selling costs, real construction-loan financing, all-in cost, and profit — instantly." },
            { n: "03", t: "Fund & execute", b: "See hard-money lenders that cover your state, then jump straight to the city's permit portal, zoning code, and parcel map." },
          ].map((s) => (
            <div key={s.n}>
              <div className="font-display text-gold text-3xl">{s.n}</div>
              <h3 className="mt-2 font-display text-2xl">{s.t}</h3>
              <p className="mt-3 text-muted-foreground leading-relaxed">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-24">
        <Card className="bg-foreground text-background border-foreground overflow-hidden">
          <CardContent className="p-12 lg:p-16 relative">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
            <div className="relative max-w-2xl">
              <Badge variant="gold" className="rounded-full">Free to start</Badge>
              <h2 className="mt-5 font-display text-4xl sm:text-5xl text-background tracking-tight">
                Stop guessing. Start building.
              </h2>
              <p className="mt-4 text-background/80 text-lg leading-relaxed">
                The permits are public. The math is honest. The lenders are real.
                All that's missing is you.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" variant="gold" asChild>
                  <Link to="/sign-up">Sign up free <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent border-background/30 text-background hover:bg-background/10 hover:text-background" asChild>
                  <Link to="/map">Explore the live map</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-gold/10 blur-3xl" aria-hidden />
      <Card className="relative shadow-elevated">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="stat-label">Sample underwrite · Austin, TX</div>
              <div className="mt-1 font-display text-lg">E 5th St · Fourplex</div>
            </div>
            <Badge variant="gold">Sample</Badge>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            {[
              ["All-in cost", "$1.07M"],
              ["Sells for", "$1.34M"],
              ["Profit", "$186K"],
            ].map(([l, v]) => (
              <div key={l} className="rounded-md border border-border bg-secondary/40 p-3">
                <div className="stat-label">{l}</div>
                <div className={`mt-1 font-display text-xl ${l === "Profit" ? "text-emerald-600" : ""}`}>{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md border border-border bg-background p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Construction financing</span>
              <span className="text-foreground font-medium">85% LTC · 11.5% · 2 pts</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Selling costs</span>
              <span className="text-foreground font-medium">6.7% realtor + closing</span>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
              </span>
              <span className="text-foreground">Live · 8 cities streaming public records</span>
            </div>
            <span className="text-xs text-muted-foreground">self-updating</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
