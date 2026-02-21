import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";
import { Leaf, Settings, Upload, Activity, GitMerge, FileText, Lightbulb, Rocket, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

interface Step {
  path: string;
  label: string;
  icon: React.ElementType;
  aiInfraOnly?: boolean;
}

const STEPS: Step[] = [
  { path: "/setup", label: "Setup", icon: Settings },
  { path: "/upload", label: "Upload", icon: Upload },
  { path: "/activities", label: "Activities", icon: Activity },
  { path: "/mapping", label: "Mapping", icon: GitMerge },
  { path: "/report", label: "Report", icon: FileText },
  { path: "/recommendations", label: "Recommendations", icon: Lightbulb },
  { path: "/deploy", label: "Deploy", icon: Rocket, aiInfraOnly: true },
];

export default function DashboardLayout() {
  const { project } = useProject();
  const location = useLocation();
  const navigate = useNavigate();

  const visibleSteps = STEPS.filter(
    (s) => !s.aiInfraOnly || project.companyType === "ai_infra"
  );

  const currentIdx = visibleSteps.findIndex((s) => s.path === location.pathname);
  const isUpload = location.pathname === "/upload";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between h-14 px-6 gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold tracking-tight whitespace-nowrap">
                <span className="text-gradient-green">Impact</span>Check
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-md px-1.5 py-0.5">
                v2
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground truncate max-w-[120px]">{project.projectName}</span>
              <span className="text-xs border border-border rounded-md px-1.5 py-0.5">{project.year}</span>
              {project.regions.length > 0 && (
                <span className="text-xs truncate max-w-[100px]">{project.regions.join(", ")}</span>
              )}
            </div>
            {!isUpload && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg hidden sm:inline-flex"
                onClick={() => navigate("/upload")}
              >
                Upload
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar stepper - Donezo style: light gray bg, green vertical bar for active */}
        <aside className="w-[200px] shrink-0 border-r border-sidebar-border bg-sidebar hidden md:flex flex-col">
          <nav className="flex-1 py-6 px-2 space-y-0.5">
            {visibleSteps.map((step, idx) => {
              const isActive = idx === currentIdx;
              const isCompleted = currentIdx > idx;
              const StepIcon = step.icon;

              return (
                <button
                  key={step.path}
                  onClick={() => navigate(step.path)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left relative",
                    isActive && "bg-sidebar-accent text-sidebar-primary dark:bg-sidebar-accent dark:text-sidebar-primary",
                    isCompleted && !isActive && "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                    !isActive && !isCompleted && "text-muted-foreground/70 hover:text-muted-foreground hover:bg-sidebar-accent/30"
                  )}
                >
                  {/* Green vertical bar for active step */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                  )}
                  <div
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded-lg shrink-0 relative z-10",
                      isActive && "bg-primary text-primary-foreground",
                      isCompleted && !isActive && "bg-primary/10 dark:bg-primary/20 text-primary",
                      !isActive && !isCompleted && "bg-muted/50 dark:bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted && !isActive ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <StepIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span className="relative z-10">{step.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
