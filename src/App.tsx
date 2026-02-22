import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import DashboardLayout from "@/layouts/DashboardLayout";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Setup from "@/pages/Setup";
import Upload from "@/pages/Upload";
import EmissionsCalculation from "@/pages/EmissionsCalculation";
import Benchmarking from "@/pages/Benchmarking";
import Report from "@/pages/Report";
import Recommendations from "@/pages/Recommendations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <ProjectProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
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
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
