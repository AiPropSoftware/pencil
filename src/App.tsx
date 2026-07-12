import * as React from "react";
import { Routes, Route } from "react-router-dom";
import { CrashBoundary } from "@/components/CrashBoundary";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/toaster";
import { RequireAuth } from "@/components/RequireAuth";
import MapPage from "@/pages/Map";
import Landing from "@/pages/Landing";

// The map IS the app — every other page lazy-loads off the critical path.
const DealAnalyzer = React.lazy(() => import("@/pages/DealAnalyzer"));
const Terms = React.lazy(() => import("@/pages/Terms"));
const Privacy = React.lazy(() => import("@/pages/Privacy"));
const SignIn = React.lazy(() => import("@/pages/SignIn"));
const SignUp = React.lazy(() => import("@/pages/SignUp"));
const Admin = React.lazy(() => import("@/pages/Admin"));
const BillingSuccess = React.lazy(() => import("@/pages/BillingSuccess"));
const NotFound = React.lazy(() => import("@/pages/NotFound"));
const Library = React.lazy(() => import("@/pages/Library"));

const PageFallback = () => (
  <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground animate-pulse">Loading…</div>
);

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <CrashBoundary>
        <React.Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Front door for visitors; signed-in users go straight to the map. */}
          <Route path="/" element={<Landing />} />
          {/* Single surface: the map IS the app. */}
          <Route path="/map" element={<MapPage />} />

          {/* Drill-downs (reached from the map, not from any menu). */}
          <Route path="/deal-analyzer" element={<DealAnalyzer />} />
          <Route path="/library" element={<Library />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/billing/success" element={<BillingSuccess />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route
            path="/admin"
            element={
              <RequireAuth requireRole="admin">
                <Admin />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </React.Suspense>
        </CrashBoundary>
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}
