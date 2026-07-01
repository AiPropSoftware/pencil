export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Pencil — investors become developers.</span>
        <a href="mailto:hello@pencil.app" className="hover:text-gold">hello@pencil.app</a>
      </div>
    </footer>
  );
}
