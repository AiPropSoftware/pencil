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
          <Route
            path="/deal-analyzer"
            element={
              <RequireAuth requireRole="pro">
                <DealAnalyzer />
              </RequireAuth>
            }
          />
          <Route
            path="/map"
            element={
              <RequireAuth requireRole="pro">
                <MapPage />
              </RequireAuth>
            }
          />
          <Route
            path="/comps"
            element={
              <RequireAuth requireRole="pro">
                <Comps />
              </RequireAuth>
            }
          />
          <Route
            path="/builders"
            element={
              <RequireAuth requireRole="pro">
                <Builders />
              </RequireAuth>
            }
          />
          <Route
            path="/library"
            element={
              <RequireAuth requireRole="pro">
                <Library />
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
