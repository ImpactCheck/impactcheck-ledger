import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Settings, Upload, Activity, GitMerge, FileText, Lightbulb, Rocket,
  Check, Sun, Moon, LayoutDashboard,
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useStepCompletion } from "@/hooks/useStepCompletion";
import type { StepCompletion } from "@/hooks/useStepCompletion";

const REGION_LABELS: Record<string, string> = {
  texas_ercot: "Texas (ERCOT)",
  norway_hydro: "Norway (Hydro)",
  virginia_pjm: "Virginia (PJM)",
  iowa_miso: "Iowa (MISO)",
  iceland_geo: "Iceland (Geo)",
  singapore: "Singapore",
};

interface Step {
  path: string;
  label: string;
  icon: React.ElementType;
  deployOnly?: boolean;
  completionKey: keyof StepCompletion;
}

const STEPS: Step[] = [
  { path: "/setup", label: "Setup", icon: Settings, completionKey: "setup" },
  { path: "/upload", label: "Upload", icon: Upload, completionKey: "upload" },
  { path: "/activities", label: "Activities", icon: Activity, completionKey: "activities" },
  { path: "/mapping", label: "Mapping", icon: GitMerge, completionKey: "mapping" },
  { path: "/report", label: "Report", icon: FileText, completionKey: "report" },
  { path: "/recommendations", label: "Suggest", icon: Lightbulb, completionKey: "recommendations" },
  { path: "/deploy", label: "Deploy", icon: Rocket, deployOnly: true, completionKey: "deploy" },
];

export default function DashboardLayout() {
  const { project } = useProject();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const completion = useStepCompletion();

  const visibleSteps = STEPS.filter((s) => !s.deployOnly || project.deployOptIn);

  const currentStepIndex = visibleSteps.findIndex((s) => s.path === location.pathname);
  const completedCount = visibleSteps.filter((s) => completion[s.completionKey]).length;

  const primaryRegionLabel = project.primaryRegion
    ? (REGION_LABELS[project.primaryRegion] ?? project.primaryRegion.replace(/_/g, " "))
    : null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar (desktop) ─────────────────────────────────────── */}
      <aside className="w-[272px] shrink-0 hidden md:flex flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen">

        {/* Logo */}
        <div className="px-6 py-5 flex items-center gap-3 border-b border-sidebar-border/60">
          <img src={logoImg} alt="ImpactCheck" className="h-9 w-9 object-contain" />
          <div>
            <span className="text-base font-bold tracking-tight text-foreground">ImpactCheck</span>
            <p className="text-[10px] text-muted-foreground font-mono -mt-0.5">Carbon Audit Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto">

          {/* Back to dashboard */}
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all mb-4 cursor-pointer"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-muted text-muted-foreground">
              <LayoutDashboard className="h-3.5 w-3.5" />
            </div>
            <span>All Projects</span>
          </button>

          {/* Workflow label + progress */}
          <div className="flex items-center justify-between px-3 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Workflow
            </p>
            <span className="text-[10px] font-mono text-muted-foreground">
              {completedCount}/{visibleSteps.length}
            </span>
          </div>

          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-[27px] top-4 bottom-4 w-px bg-border" aria-hidden />

            <div className="space-y-1">
              {visibleSteps.map((step, idx) => {
                const isActive = step.path === location.pathname;
                const isCompleted = completion[step.completionKey];
                const StepIcon = step.icon;
                const stepNum = String(idx + 1).padStart(2, "0");

                return (
                  <button
                    key={step.path}
                    onClick={() => navigate(step.path)}
                    className={cn(
                      "relative w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium transition-all text-left group cursor-pointer",
                      isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/20",
                      isCompleted && !isActive && "text-foreground hover:bg-muted",
                      !isActive && !isCompleted && "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {/* Step icon circle (sits over the connector line) */}
                    <div
                      className={cn(
                        "relative z-10 flex items-center justify-center h-7 w-7 rounded-lg text-xs shrink-0 transition-colors",
                        isActive && "bg-primary-foreground/20 text-primary-foreground",
                        isCompleted && !isActive && "bg-primary/10 text-primary",
                        !isActive && !isCompleted && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted && !isActive ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <StepIcon className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <span className="flex-1">{step.label}</span>

                    {/* Step number (right side, desktop) */}
                    <span
                      className={cn(
                        "text-[10px] font-mono shrink-0 transition-colors",
                        isActive ? "text-primary-foreground/60" : "text-muted-foreground/50"
                      )}
                    >
                      {stepNum}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Bottom section */}
        <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-muted text-muted-foreground">
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </div>
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>

          {/* Project info card */}
          <div className="rounded-2xl bg-muted/50 border border-border/60 px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Current project</p>
            <p className="text-sm font-semibold text-foreground truncate leading-tight">{project.projectName}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground font-mono">{project.year}</span>
              {primaryRegionLabel && (
                <>
                  <span className="text-[10px] text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground truncate">{primaryRegionLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Content area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-card/90 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="ImpactCheck" className="h-7 w-7 object-contain" />
            <span className="text-sm font-bold">ImpactCheck</span>
          </div>
          <div className="flex items-center gap-2">
            {currentStepIndex >= 0 && (
              <span className="text-xs text-muted-foreground font-mono">
                Step {currentStepIndex + 1}/{visibleSteps.length}
              </span>
            )}
            <button
              onClick={toggleTheme}
              className="h-8 w-8 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="px-5 py-7 md:px-8 md:py-8 max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border">
          <div className="flex items-center justify-around px-1 py-1.5">
            {/* Dashboard home */}
            <button
              onClick={() => navigate("/")}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors cursor-pointer",
                location.pathname === "/"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="text-[9px] font-medium">Home</span>
            </button>

            {/* Show first 5 workflow steps in mobile nav */}
            {visibleSteps.slice(0, 5).map((step) => {
              const isActive = step.path === location.pathname;
              const isCompleted = completion[step.completionKey];
              const StepIcon = step.icon;
              return (
                <button
                  key={step.path}
                  onClick={() => navigate(step.path)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors cursor-pointer relative",
                    isActive
                      ? "text-primary"
                      : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isCompleted && !isActive && (
                    <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                  <StepIcon className="h-5 w-5" />
                  <span className="text-[9px] font-medium">{step.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
