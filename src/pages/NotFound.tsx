import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container py-32 text-center">
      <p className="stat-label">404</p>
      <h1 className="mt-4 font-display text-5xl">Page not found</h1>
      <p className="mt-3 text-muted-foreground">
        The page you’re looking for doesn’t exist.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
