import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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

const NAV = [
  { to: "/deal-analyzer", label: "Deal Analyzer" },
  { to: "/map", label: "Map" },
  { to: "/comps", label: "Comps" },
  { to: "/builders", label: "Builders" },
  { to: "/library", label: "Library" },
];

export function Header() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-10">
          <Logo />
          <nav className="hidden md:flex items-center gap-7">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "text-sm font-medium transition-colors flex items-center gap-1",
                    isActive ? "text-gold" : "text-muted-foreground hover:text-gold",
                  )
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden sm:block text-sm text-muted-foreground">
                {user.email}
              </span>
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
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" variant="gold" asChild>
                <Link to="/sign-up">Start free trial</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
