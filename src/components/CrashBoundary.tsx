import * as React from "react";

/**
 * Last line of defense: a render crash anywhere below unmounts React's whole
 * tree in production — the user sees a silent blank page. This catches it,
 * shows a recoverable card instead, and prints the real error + component
 * stack to the console so it can be diagnosed from a user report.
 */
export class CrashBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[Pencil] crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-[60vh] place-items-center p-6">
          <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-card">
            <p className="text-lg font-semibold">Something went wrong</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The map hit an unexpected error. Reloading usually fixes it — if it
              keeps happening, the details are in the browser console.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
