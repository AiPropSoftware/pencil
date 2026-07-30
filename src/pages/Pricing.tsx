import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck, Radar, FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UpgradeButton } from "@/components/UpgradeButton";
import { useAuth } from "@/hooks/useAuth";

/**
 * Pricing. Anchored against what the alternative actually costs a small
 * developer: a $2,500+ architect feasibility study per lot, $197 one-off
 * zoning reports, or $500+/mo institutional suites. Every feature claim on
 * this page maps to something the product verifiably does today.
 */

const TIERS: {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  featured?: boolean;
}[] = [
  {
    name: "Explorer",
    price: "$0",
    cadence: "forever",
    blurb: "Kick the tires on real lots with real numbers.",
    features: [
      "Zoning X-ray on the live map",
      "Instant pro forma on any address",
      "Full deal analyzer with honest financing math",
      "Live permit intel — see who's building where",
      "3 saved pro formas",
    ],
  },
  {
    name: "Pro",
    price: "", // computed from the billing toggle
    cadence: "",
    blurb: "For investors underwriting lots every week.",
    featured: true,
    features: [
      "Everything in Explorer, unlimited",
      "Unlimited saved pro formas + deal library",
      "Investor memo export — share with partners & lenders",
      "Recorded lot sizes from county records, auto-filled",
      "Verified builder & permit records by address",
      "Priority support from the founders",
    ],
  },
  {
    name: "Team",
    price: "$399",
    cadence: "per month",
    blurb: "For land agents, wholesalers, and small builders.",
    features: [
      "Everything in Pro, for 5 seats",
      "Shared deal library across your team",
      "New-city zoning requests, prioritized",
      "White-label pro forma exports",
      "Onboarding call with the founders",
    ],
  },
];

const TRUST = [
  {
    icon: ShieldCheck,
    title: "Sourced, not scraped-and-guessed",
    body:
      "Zoning tables are hand-verified against the published code — every number carries its section citation (e.g. Austin LDC § 25-2-492). If a district isn't verified, Pencil says so instead of guessing.",
  },
  {
    icon: Radar,
    title: "Watched every single day",
    body:
      "An automated canary probes every live data source daily — city permit feeds, county parcel records, zoning layers. When a city changes something, we know before you do.",
  },
  {
    icon: FileText,
    title: "Decision support you can defend",
    body:
      "Pro formas show every assumption: financing terms, selling costs, build $/sf with provenance. Hand the memo to a partner or lender without translating it first.",
  },
];

const ALTERNATIVES: { what: string; cost: string; gap: string }[] = [
  {
    what: "Architect feasibility study",
    cost: "$2,500+ per lot, 2–4 weeks",
    gap: "Definitive — but you pay it before you know if the deal is worth it.",
  },
  {
    what: "One-off zoning report services",
    cost: "~$197 per report",
    gap: "One address, one PDF. No underwriting, no permits, no market data.",
  },
  {
    what: "Lead-gen data platforms",
    cost: "$99–150 / mo + add-ons",
    gap: "Great owner data — but no zoning math. They tell you who owns the lot, not what it can become.",
  },
  {
    what: "Institutional feasibility suites",
    cost: "$499–5,999 / mo",
    gap: "Built for funds screening thousands of parcels — priced like it, too.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need a credit card for the trial?",
    a: "No. The 7-day Pro trial starts without a card. If you don't subscribe, your account simply drops to Explorer — nothing is deleted.",
  },
  {
    q: "Is the data actually real?",
    a: "Yes — that's the whole point. Zoning rules are verified against published city codes with citations shown in the product. Permits, parcels, and lot sizes stream live from city and county public records at the moment you look. Every source is health-checked daily by an automated monitor.",
  },
  {
    q: "Which cities are covered?",
    a: "Verified zoning rules in 12 metros (Austin is deepest, with all 31 base districts and overlay decoding), live permits in 9 metros, and recorded lot sizes across most US states. Everywhere else, Pencil links the official code and computes exact math from the numbers you enter — it never guesses a regulation.",
  },
  {
    q: "Is this a zoning determination?",
    a: "No. Pencil is decision support with citations — it tells you what the published code says a lot allows, and flags overlays that can change the answer. Verify with the city before you close. It's how you decide which lots deserve the architect, not a replacement for one.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes — cancel in one click, effective at the end of your billing period. No calls, no retention flow.",
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [annual, setAnnual] = React.useState(true);

  const proCta = user ? (
    <UpgradeButton size="lg" className="w-full" interval={annual ? "annual" : "monthly"}>
      Start 7-day free trial <ArrowRight className="h-4 w-4" />
    </UpgradeButton>
  ) : (
    <Button size="lg" variant="gold" className="w-full" asChild>
      <Link to="/sign-up">
        Start 7-day free trial <ArrowRight className="h-4 w-4" />
      </Link>
    </Button>
  );

  return (
    <div>
      {/* Hero */}
      <section className="container pt-16 pb-10 lg:pt-24 text-center">
        <div className="stat-label">Pricing</div>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight max-w-3xl mx-auto">
          One bad lot costs more than a decade of Pencil.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Know what a lot can become — zoning, buildable square feet, and the full
          pro forma — before you write the offer, not after you own the mistake.
        </p>
      </section>

      {/* Anchor strip */}
      <section className="container pb-14">
        <div className="mx-auto max-w-3xl grid sm:grid-cols-3 gap-px rounded-lg border border-border bg-border overflow-hidden text-center">
          {[
            ["$2,500+", "an architect feasibility study, per lot"],
            ["$197", "a single zoning report elsewhere"],
            ["from $124/mo", "Pencil Pro — unlimited lots"],
          ].map(([v, l], i) => (
            <div key={l} className={`p-6 ${i === 2 ? "bg-gold-muted/40" : "bg-card"}`}>
              <div className={`font-display text-3xl ${i === 2 ? "text-foreground" : "text-muted-foreground"}`}>{v}</div>
              <div className="mt-1.5 text-xs text-muted-foreground leading-snug">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section className="container pb-20">
        <div className="mb-10 flex items-center justify-center gap-1 text-sm">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-full px-4 py-1.5 transition-colors ${annual ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              Annual <span className={annual ? "text-gold" : "text-gold/80"}>· 2 months free</span>
            </button>
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-4 py-1.5 transition-colors ${!annual ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              Monthly
            </button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3 max-w-5xl mx-auto items-stretch">
          {TIERS.map((t) => (
            <Card
              key={t.name}
              className={t.featured ? "relative border-gold shadow-elevated" : "relative"}
            >
              {t.featured && (
                <Badge variant="gold" className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full">
                  Most popular
                </Badge>
              )}
              <CardContent className="p-7 flex flex-col h-full">
                <div className="stat-label">{t.name}</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-5xl tracking-tight">
                    {t.name === "Pro" ? (annual ? "$124" : "$149") : t.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t.name === "Pro" ? "per month" : t.cadence}
                  </span>
                </div>
                {t.name === "Pro" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {annual ? "billed annually — $1,490/yr (2 months free)" : "month-to-month, or $124/mo billed annually"}
                  </div>
                )}
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{t.blurb}</p>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm leading-snug">
                      <Check className="h-4 w-4 shrink-0 text-gold mt-0.5" />
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  {t.name === "Pro" ? (
                    <>
                      {proCta}
                      <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
                        No credit card required · cancel anytime
                      </p>
                    </>
                  ) : t.name === "Team" ? (
                    <Button size="lg" variant="outline" className="w-full" asChild>
                      <a href="mailto:contact@rhequitiescorp.com?subject=Pencil%20Team%20plan">
                        Talk to the founders
                      </a>
                    </Button>
                  ) : (
                    <Button size="lg" variant="outline" className="w-full" asChild>
                      <Link to={user ? "/map" : "/sign-up"}>
                        {user ? "Open the map" : "Sign up free"}
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground max-w-xl mx-auto">
          <Sparkles className="inline h-3.5 w-3.5 text-gold -mt-0.5" /> Launch
          cohort: every account currently gets full access while we onboard the
          first wave — lock in Pro pricing before gating begins.
        </p>
      </section>

      <div className="section-divider" />

      {/* Trust */}
      <section className="container py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="stat-label">Why the numbers hold up</div>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl tracking-tight">
            Accuracy is the product.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {TRUST.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border bg-card p-7">
              <Icon className="h-5 w-5 text-gold" />
              <h3 className="mt-4 font-display text-xl">{title}</h3>
              <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* Alternatives */}
      <section className="container py-20">
        <div className="text-center max-w-2xl mx-auto">
          <div className="stat-label">The alternative</div>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl tracking-tight">
            What answering “what can I build here?” costs today
          </h2>
        </div>
        <div className="mt-12 max-w-3xl mx-auto overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {ALTERNATIVES.map((a) => (
                <tr key={a.what} className="border-b border-border/60 last:border-0">
                  <td className="py-4 pr-4 align-top">
                    <div className="font-medium text-foreground">{a.what}</div>
                    <div className="mt-1 text-muted-foreground text-xs leading-relaxed">{a.gap}</div>
                  </td>
                  <td className="py-4 text-right align-top whitespace-nowrap font-display text-lg text-muted-foreground">
                    {a.cost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Pencil sits in the gap: investor pricing, developer-grade answers, one tool.
          </p>
        </div>
      </section>

      <div className="section-divider" />

      {/* FAQ */}
      <section className="container py-20">
        <div className="text-center">
          <div className="stat-label">Questions</div>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl tracking-tight">Fair questions, straight answers</h2>
        </div>
        <div className="mt-12 max-w-2xl mx-auto space-y-8">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="font-display text-lg">{f.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <Card className="bg-foreground text-background border-foreground overflow-hidden">
          <CardContent className="p-12 relative">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
            <div className="relative max-w-2xl">
              <h2 className="font-display text-3xl sm:text-4xl text-background tracking-tight">
                Underwrite your first lot tonight.
              </h2>
              <p className="mt-3 text-background/80 leading-relaxed">
                Drop in an address. See the zoning, the buildable square feet, and
                the whole deal — in under a minute.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" variant="gold" asChild>
                  <Link to={user ? "/map" : "/sign-up"}>
                    {user ? "Open the map" : "Start free"} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
