import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";
import { Leaf, Settings, Upload, Activity, GitMerge, FileText, Lightbulb, Rocket, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-2.5">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-gradient-green">Impact</span>Check
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground border rounded px-1.5 py-0.5 ml-1">
              v2
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{project.projectName}</span>
            <span className="text-xs border rounded px-1.5 py-0.5">{project.year}</span>
            {project.regions.length > 0 && (
              <span className="text-xs">{project.regions.join(", ")}</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar stepper */}
        <aside className="w-60 shrink-0 border-r bg-card/30 hidden md:flex flex-col">
          <nav className="flex-1 py-6 px-3 space-y-1">
            {visibleSteps.map((step, idx) => {
              const isActive = idx === currentIdx;
              const isCompleted = currentIdx > idx;
              const StepIcon = step.icon;

              return (
                <button
                  key={step.path}
                  onClick={() => navigate(step.path)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors text-left",
                    isActive && "bg-primary/10 text-primary border border-primary/20",
                    isCompleted && !isActive && "text-muted-foreground hover:text-foreground hover:bg-accent",
                    !isActive && !isCompleted && "text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded-full border text-xs shrink-0",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      isCompleted && !isActive && "border-primary/50 bg-primary/10 text-primary",
                      !isActive && !isCompleted && "border-border text-muted-foreground/60"
                    )}
                  >
                    {isCompleted && !isActive ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <StepIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span>{step.label}</span>
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
