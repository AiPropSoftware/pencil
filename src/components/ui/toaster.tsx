import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "bg-card text-card-foreground border border-border shadow-elevated",
          description: "text-muted-foreground",
          actionButton: "bg-gold text-gold-foreground",
        },
      }}
    />
  );
}
