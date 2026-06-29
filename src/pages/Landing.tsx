import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calculator, Map as MapIcon, BarChart3, HardHat,
  ArrowRight, Check, TrendingUp, FileText, Sparkles,
} from "lucide-react";

const MODULES = [
  {
    icon: Calculator,
    title: "Deal Analyzer",
    body: "The same underwriting model the $40K Developer Launch program teaches — ported into software. Live results for hard cost, carry, refi cash-back, DSCR, cash-on-cash, cap rate, and partner waterfall.",
  },
  {
    icon: MapIcon,
    title: "Geo Developer Map",
    body: "Drop a pin or draw a polygon. See every active developer in that radius, what they build, how many projects they have under permit, and a clean profile drawer for outreach.",
  },
  {
    icon: BarChart3,
    title: "Comps Engine",
    body: "Brand-new construction sold in the last 12 months — $/sqft scatter, percentile bands, days on market, sold-to-list. One click pre-fills your Deal Analyzer with the median.",
  },
  {
    icon: HardHat,
    title: "Builder Directory",
    body: "Verified GCs and trades by metro with past projects, license numbers, and typical price bands. Request-a-quote built in.",
  },
];

const PROOF = [
  ["Avg projected profit per deal", "$220K+"],
  ["Markets covered", "412"],
  ["Permits indexed monthly", "180K"],
];

const BULLETS = [
  "Replace turnkey rental returns with developer-margin returns",
  "Underwrite ground-up before you put a dollar down",
  "Find off-market infill lots your competition isn't running",
  "Vet the right builder, not the most expensive Google result",
];

export default function Landing() {
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="container pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <Badge variant="gold" className="rounded-full">
              <Sparkles className="mr-1.5 h-3 w-3" /> New: Geo Developer Map
            </Badge>
            <h1 className="mt-5 font-display text-5xl sm:text-6xl lg:text-[68px] leading-[1.05] tracking-tight">
              Investors become <em className="text-gold not-italic font-display">developers</em>.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              Pencil is the software companion to the Developer Launch playbook.
              Underwrite, locate, and execute ground-up small multifamily and
              infill development deals — with data instead of guesswork.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" variant="gold" asChild>
                <Link to="/sign-up">
                  Sign up <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/deal-analyzer">Try the Deal Analyzer</Link>
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

      {/* Proof */}
      <section className="container py-14">
        <div className="grid sm:grid-cols-3 gap-10">
          {PROOF.map(([label, value]) => (
            <div key={label} className="text-center sm:text-left">
              <div className="font-display text-4xl text-foreground">{value}</div>
              <div className="mt-2 stat-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* Modules */}
      <section className="container py-24" id="modules">
        <div className="max-w-2xl">
          <div className="gold-rule" />
          <h2 className="mt-5 font-display text-4xl sm:text-5xl tracking-tight">
            Four modules. One conviction.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Every ground-up deal lives or dies on the same four questions:
            does the math work, is anyone else building here, what are
            finished homes worth, and who will build it. Pencil answers all
            four in one workspace.
          </p>
        </div>
        <div className="mt-14 grid md:grid-cols-2 gap-6">
          {MODULES.map(({ icon: Icon, title, body }) => (
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
            { n: "01", t: "Underwrite", b: "Plug land, hard cost, ARV, and rent. Pencil returns a banker-ready pro forma in under 30 seconds." },
            { n: "02", t: "Locate", b: "Polygon-search any metro. Pencil surfaces active developers, permit activity, and new-construction comps." },
            { n: "03", t: "Execute", b: "Save the deal, share it with your capital partner, and request quotes from vetted builders." },
          ].map((s) => (
            <div key={s.n}>
              <div className="font-display text-gold text-3xl">{s.n}</div>
              <h3 className="mt-2 font-display text-2xl">{s.t}</h3>
              <p className="mt-3 text-muted-foreground leading-relaxed">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="container py-24" id="pricing">
        <Card className="bg-foreground text-background border-foreground overflow-hidden">
          <CardContent className="p-12 lg:p-16 relative">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
            <div className="relative max-w-2xl">
              <Badge variant="gold" className="rounded-full">14-day free trial</Badge>
              <h2 className="mt-5 font-display text-4xl sm:text-5xl text-background tracking-tight">
                Stop buying turnkey. Start building.
              </h2>
              <p className="mt-4 text-background/80 text-lg leading-relaxed">
                Pencil Pro is $149/month. One avoided bad deal pays for it for the next decade.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" variant="gold" asChild>
                  <Link to="/sign-up">Sign up <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent border-background/30 text-background hover:bg-background/10 hover:text-background" asChild>
                  <Link to="/deal-analyzer">Try the Deal Analyzer</Link>
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
              <div className="stat-label">Sample deal · Austin, TX</div>
              <div className="mt-1 font-display text-lg">2421 E 5th St · Fourplex</div>
            </div>
            <Badge variant="gold">Cash-on-cash 18.4%</Badge>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            {[
              ["All-in cost", "$1.07M"],
              ["ARV", "$1.34M"],
              ["Profit", "$268K"],
            ].map(([l, v]) => (
              <div key={l} className="rounded-md border border-border bg-secondary/40 p-3">
                <div className="stat-label">{l}</div>
                <div className="mt-1 font-display text-xl">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-md border border-border bg-background p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Refi cash-back</span>
              <span className="text-gold font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> 100% of initial cash
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-gold to-gold/60" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
              <span>Hard cost</span><span className="text-center">Carry</span><span className="text-right">Refi</span>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2.5 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Banker-ready PDF</span>
            </div>
            <span className="text-xs text-muted-foreground">1-click export</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
