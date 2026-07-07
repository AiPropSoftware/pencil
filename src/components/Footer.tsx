import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Pencil — investors become developers.</span>
        <div className="flex items-center gap-4">
          <Link to="/terms" className="hover:text-gold">Terms</Link>
          <Link to="/privacy" className="hover:text-gold">Privacy</Link>
          <a href="mailto:hello@pencil.app" className="hover:text-gold">hello@pencil.app</a>
        </div>
      </div>
    </footer>
  );
}
