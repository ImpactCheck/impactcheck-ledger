import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import DashboardLayout from "@/layouts/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import Setup from "@/pages/Setup";
import Upload from "@/pages/Upload";
import Activities from "@/pages/Activities";
import Mapping from "@/pages/Mapping";
import Report from "@/pages/Report";
import Recommendations from "@/pages/Recommendations";
import Deploy from "@/pages/Deploy";
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
            <Route path="/" element={<Dashboard />} />
            <Route element={<DashboardLayout />}>
              <Route path="/setup" element={<Setup />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/activities" element={<Activities />} />
              <Route path="/mapping" element={<Mapping />} />
              <Route path="/report" element={<Report />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/deploy" element={<Deploy />} />
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
