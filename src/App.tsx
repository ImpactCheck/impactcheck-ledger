import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProjectProvider, useProject } from "@/contexts/ProjectContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/layouts/DashboardLayout";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Setup from "@/pages/Setup";
import Upload from "@/pages/Upload";
import EmissionsCalculation from "@/pages/EmissionsCalculation";
import Benchmarking from "@/pages/Benchmarking";
import Report from "@/pages/Report";
import Recommendations from "@/pages/Recommendations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Syncs subscription tier → project useCase */
function TierSync() {
  const { subscriptionTier } = useAuth();
  const { syncTier } = useProject();
  useEffect(() => { syncTier(subscriptionTier); }, [subscriptionTier]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <ProjectProvider>
            <TierSync />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/app" element={<Dashboard />} />
                <Route element={<DashboardLayout />}>
                  <Route path="/setup" element={<Setup />} />
                  <Route path="/upload" element={<Upload />} />
                  {/* Legacy redirects */}
                  <Route path="/activities" element={<Navigate to="/emissions" replace />} />
                  <Route path="/mapping" element={<Navigate to="/emissions" replace />} />
                  <Route path="/emissions" element={<EmissionsCalculation />} />
                  <Route path="/benchmarking" element={<Benchmarking />} />
                  <Route path="/report" element={<Report />} />
                  <Route path="/recommendations" element={<Recommendations />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ProjectProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
