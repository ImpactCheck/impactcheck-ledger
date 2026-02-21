import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { Project } from "@/contracts/impactcheck.v2";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Leaf, Plus, MapPin, Calendar, Building2, ArrowRight, Sun, Moon, Trash2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const REGION_LABELS: Record<string, string> = {
  texas_ercot: "Texas (ERCOT)",
  norway_hydro: "Norway (Hydro)",
  virginia_pjm: "Virginia (PJM)",
  iowa_miso: "Iowa (MISO)",
  iceland_geo: "Iceland (Geo)",
  singapore: "Singapore",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { updateProject } = useProject();
  const { theme, toggleTheme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.listProjects().then(setProjects);
  }, []);

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    try {
      await api.deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const openProject = (proj: Project) => {
    updateProject({
      currentProjectId: proj.id,
      projectName: proj.name,
      year: proj.year,
      companyType: proj.companyType === "ai_infra" ? "ai_infra" : "other",
      primaryRegion: proj.primaryRegion,
      comparisonRegions: proj.comparisonRegions ?? [],
      regions: [proj.primaryRegion, ...(proj.comparisonRegions ?? [])],
      baselineFootprintKgCO2e: proj.baselineFootprintKgCO2e,
    });
    navigate("/setup");
  };

  const handleNewProject = () => {
    updateProject({
      currentProjectId: null,
      projectName: "Untitled Project",
      year: 2026,
      companyType: "ai_infra",
      primaryRegion: "",
      comparisonRegions: [],
      regions: [],
      baselineFootprintKgCO2e: undefined,
    });
    navigate("/setup");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-green flex items-center justify-center">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">ImpactCheck</span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground bg-muted rounded-full px-2 py-0.5 font-semibold">
              v2
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Moon className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 animate-fade-in-up">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your carbon audit projects and track sustainability progress.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <Card className="card-elevated border-0 overflow-hidden">
            <div className="bg-gradient-green p-5 text-primary-foreground">
              <p className="text-xs uppercase tracking-wider opacity-80">Total Projects</p>
              <p className="text-3xl font-bold font-mono mt-1">{projects.length}</p>
              <p className="text-xs opacity-70 mt-1">Active audits</p>
            </div>
          </Card>
          <Card className="card-elevated border-0">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">AI Infrastructure</p>
              <p className="text-3xl font-bold font-mono mt-1">
                {projects.filter(p => p.companyType === "ai_infra").length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Deploy-ready projects</p>
            </CardContent>
          </Card>
          <Card className="card-elevated border-0">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Regions Covered</p>
              <p className="text-3xl font-bold font-mono mt-1">
                {new Set(projects.flatMap(p => [p.primaryRegion, ...(p.comparisonRegions ?? [])])).size}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Unique regions</p>
            </CardContent>
          </Card>
        </div>

        {/* Projects grid */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Button onClick={handleNewProject} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" /> New Project
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => (
            <Card
              key={proj.id}
              className="card-elevated border-0 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all group"
              onClick={() => openProject(proj)}
            >
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                      {proj.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {proj.year}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {REGION_LABELS[proj.primaryRegion] ?? proj.primaryRegion}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-1">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                          aria-label="Delete project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{proj.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this project and all its data (documents, activities, estimates, and recommendations). This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => handleDelete(e, proj.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className={proj.companyType === "ai_infra" ? "text-primary font-medium" : "text-muted-foreground"}>
                      {proj.companyType === "ai_infra" ? "AI Infrastructure" : "Enterprise"}
                    </span>
                  </span>
                  {proj.baselineFootprintKgCO2e && (
                    <span className="text-xs text-muted-foreground font-mono ml-auto">
                      Baseline: {formatTonnes(proj.baselineFootprintKgCO2e)}t
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* New project card */}
          <Card
            className="border-2 border-dashed border-border hover:border-primary/30 cursor-pointer transition-all flex items-center justify-center min-h-[160px]"
            onClick={handleNewProject}
          >
            <CardContent className="text-center py-6">
              <div className="h-12 w-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold text-sm">Create New Project</p>
              <p className="text-xs text-muted-foreground mt-1">Start a new carbon audit</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
