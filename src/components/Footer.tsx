import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-background">
      <div className="container py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2 max-w-sm">
          <div className="font-display text-2xl text-foreground">Pencil</div>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            The all-inclusive platform where investors become developers.
            Underwrite, locate, and execute ground-up infill development
            deals with data, not guesswork.
          </p>
        </div>
        <div>
          <div className="stat-label mb-3">Product</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/deal-analyzer" className="text-foreground hover:text-gold">Deal Analyzer</Link></li>
            <li><Link to="/map" className="text-foreground hover:text-gold">Geo Developer Map</Link></li>
            <li><Link to="/comps" className="text-foreground hover:text-gold">Comps Engine</Link></li>
            <li><Link to="/builders" className="text-foreground hover:text-gold">Builder Directory</Link></li>
          </ul>
        </div>
        <div>
          <div className="stat-label mb-3">Company</div>
          <ul className="space-y-2 text-sm">
            <li><a className="text-foreground hover:text-gold" href="#about">About</a></li>
            <li><a className="text-foreground hover:text-gold" href="#pricing">Pricing</a></li>
            <li><a className="text-foreground hover:text-gold" href="mailto:hello@pencil.app">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="container py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Pencil. All rights reserved.</span>
          <span className="font-display italic">Investors become developers.</span>
        </div>
      </div>
    </footer>
  );
}
