import { Routes, Route } from "react-router-dom";
import { CrashBoundary } from "@/components/CrashBoundary";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/toaster";
import { RequireAuth } from "@/components/RequireAuth";
import MapPage from "@/pages/Map";
import DealAnalyzer from "@/pages/DealAnalyzer";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";
import Admin from "@/pages/Admin";
import BillingSuccess from "@/pages/BillingSuccess";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <CrashBoundary>
        <Routes>
          {/* Single surface: the map IS the app. */}
          <Route path="/" element={<MapPage />} />
          <Route path="/map" element={<MapPage />} />

          {/* Drill-downs (reached from the map, not from any menu). */}
          <Route path="/deal-analyzer" element={<DealAnalyzer />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/billing/success" element={<BillingSuccess />} />
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
        </CrashBoundary>
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}
