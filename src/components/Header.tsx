import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-background shadow-card transition-transform group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-gold">
          <path d="M4 19 L15 8 L18 11 L7 22 Z" />
          <path d="M15 8 L18 11 L20 9 L17 6 Z" className="fill-gold opacity-70" />
        </svg>
      </span>
      <span className="font-display text-xl tracking-tight text-foreground">Pencil</span>
    </Link>
  );
}

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          {user ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
            >
              Sign out
            </Button>
          ) : (
            <Button size="sm" variant="gold" asChild>
              <Link to="/sign-up">Sign up</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
