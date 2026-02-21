import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";
import { Leaf, Settings, Upload, Activity, GitMerge, FileText, Lightbulb, Rocket, Check, ChevronRight } from "lucide-react";
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
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-6 py-5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-green flex items-center justify-center">
            <Leaf className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              ImpactCheck
            </span>
            <span className="ml-1.5 text-[9px] uppercase tracking-widest text-muted-foreground bg-muted rounded-full px-2 py-0.5 font-semibold">
              v2
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-3">
            Workflow
          </p>
          <div className="space-y-0.5">
            {visibleSteps.map((step, idx) => {
              const isActive = idx === currentIdx;
              const isCompleted = currentIdx > idx;
              const StepIcon = step.icon;

              return (
                <button
                  key={step.path}
                  onClick={() => navigate(step.path)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all text-left group",
                    isActive && "bg-primary text-primary-foreground shadow-md",
                    isCompleted && !isActive && "text-foreground hover:bg-muted",
                    !isActive && !isCompleted && "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded-lg text-xs shrink-0 transition-colors",
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
                  {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Bottom project info */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="rounded-xl bg-muted/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Project</p>
            <p className="text-sm font-semibold text-foreground truncate">{project.projectName}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground font-mono">{project.year}</span>
              {project.regions.length > 0 && (
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
