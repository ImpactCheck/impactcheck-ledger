import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Settings, Upload, Activity, GitMerge, FileText, Lightbulb, Rocket, Check, ChevronRight, Sun, Moon, LayoutDashboard } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useStepCompletion } from "@/hooks/useStepCompletion";
import type { StepCompletion } from "@/hooks/useStepCompletion";

interface Step {
  path: string;
  label: string;
  icon: React.ElementType;
  aiInfraOnly?: boolean;
  completionKey: keyof StepCompletion;
}

const STEPS: Step[] = [
  { path: "/setup", label: "Setup", icon: Settings, completionKey: "setup" },
  { path: "/upload", label: "Upload", icon: Upload, completionKey: "upload" },
  { path: "/activities", label: "Activities", icon: Activity, completionKey: "activities" },
  { path: "/mapping", label: "Mapping", icon: GitMerge, completionKey: "mapping" },
  { path: "/report", label: "Report", icon: FileText, completionKey: "report" },
  { path: "/recommendations", label: "Recommendations", icon: Lightbulb, completionKey: "recommendations" },
  { path: "/deploy", label: "Deploy", icon: Rocket, aiInfraOnly: true, completionKey: "deploy" },
];

export default function DashboardLayout() {
  const { project } = useProject();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const completion = useStepCompletion();

  const visibleSteps = STEPS.filter(
    (s) => !s.aiInfraOnly || project.companyType === "ai_infra"
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-[272px] shrink-0 hidden md:flex flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-6 py-6 flex items-center gap-3">
          <img src={logoImg} alt="ImpactCheck" className="h-10 w-10 object-contain" />
          <div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              ImpactCheck
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          {/* Back to dashboard */}
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all mb-5"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-muted text-muted-foreground">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <span>All Projects</span>
          </button>

          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-3">
            Workflow
          </p>
          <div className="space-y-1">
            {visibleSteps.map((step) => {
              const isActive = step.path === location.pathname;
              const isCompleted = completion[step.completionKey];
              const StepIcon = step.icon;

              return (
                <button
                  key={step.path}
                  onClick={() => navigate(step.path)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium transition-all text-left group",
                    isActive && "bg-primary text-primary-foreground shadow-lg",
                    isCompleted && !isActive && "text-foreground hover:bg-muted",
                    !isActive && !isCompleted && "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-xl text-xs shrink-0 transition-colors",
                      isActive && "bg-primary-foreground/20 text-primary-foreground",
                      isCompleted && !isActive && "bg-primary/10 text-primary",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted && !isActive ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="flex-1">{step.label}</span>
                  {isActive && <ChevronRight className="h-4 w-4 opacity-60" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-muted text-muted-foreground">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </div>
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>

          {/* Project info card */}
          <div className="rounded-2xl bg-muted/60 px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Project</p>
            <p className="text-sm font-semibold text-foreground truncate">{project.projectName}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-muted-foreground font-mono">{project.year}</span>
              {project.primaryRegion && (
                <span className="text-[10px] text-muted-foreground">{project.primaryRegion?.replace(/_/g, " ")}</span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
