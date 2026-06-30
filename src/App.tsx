import { Routes, Route } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/toaster";
import { RequireAuth } from "@/components/RequireAuth";
import Landing from "@/pages/Landing";
import DealAnalyzer from "@/pages/DealAnalyzer";
import MapPage from "@/pages/Map";
import Comps from "@/pages/Comps";
import Builders from "@/pages/Builders";
import Library from "@/pages/Library";
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
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/billing/success" element={<BillingSuccess />} />
          {/* Public: the Deal Analyzer is the free, client-side "try it" tool.
              Only "Save Deal" requires an account. */}
          <Route path="/deal-analyzer" element={<DealAnalyzer />} />
          {/* Core browsing is open — the map, comps, and builder directory
              work for everyone. Sign-up unlocks saving + personalization. */}
          <Route path="/map" element={<MapPage />} />
          <Route path="/comps" element={<Comps />} />
          <Route path="/builders" element={<Builders />} />
          <Route
            path="/library"
            element={
              <RequireAuth requireRole="free">
                <Library />
              </RequireAuth>
            }
          />
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
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}
