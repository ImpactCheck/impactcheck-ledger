import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { Project } from "@/contracts/impactcheck.v2";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus, MapPin, Calendar, Building2, ArrowRight, Sun, Moon,
  Trash2, BarChart2, Globe, Leaf, Sparkles,
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useTheme } from "@/contexts/ThemeContext";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listProjects().then((p) => { setProjects(p); setLoading(false); });
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
      useCase: "company",
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
      useCase: "company",
      primaryRegion: "",
      comparisonRegions: [],
      regions: [],
      baselineFootprintKgCO2e: undefined,
    });
    navigate("/setup");
  };

  const aiInfraCount = projects.filter((p) => p.companyType === "ai_infra").length;
  const regionCount = new Set(
    projects.flatMap((p) => [p.primaryRegion, ...(p.comparisonRegions ?? [])])
  ).size;

  const isEmpty = !loading && projects.length === 0;

  return (
    <div className="min-h-screen bg-background bg-mesh-green">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="ImpactCheck" className="h-9 w-9 object-contain" />
            <div>
              <span className="text-base font-bold tracking-tight">ImpactCheck</span>
              <span className="hidden sm:inline text-xs text-muted-foreground ml-2 font-mono">
                Carbon Audit Platform
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleNewProject}
              size="sm"
              className="gap-1.5 rounded-xl h-9 px-4 hidden sm:flex shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> New Project
            </Button>
            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "dark"
                ? <Sun className="h-4 w-4 text-muted-foreground" />
                : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* ── Hero / empty state ───────────────────────────────── */}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center text-center py-24 max-w-lg mx-auto">
            <div className="h-20 w-20 rounded-3xl bg-gradient-green flex items-center justify-center mb-6 glow-green">
              <Leaf className="h-9 w-9 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              Start your first audit
            </h1>
            <p className="text-muted-foreground leading-relaxed mb-8">
              ImpactCheck walks you through uploading procurement data, extracting
              emission activities with AI, and generating a full lifecycle carbon report —
              ready for regulatory compliance.
            </p>
            <Button
              onClick={handleNewProject}
              size="lg"
              className="gap-2 rounded-2xl h-12 px-8 shadow-lg shadow-primary/20 text-base"
            >
              <Plus className="h-5 w-5" /> Create Your First Project
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Supports CSV, XLSX, JSON, and PDF documents
            </p>
          </div>
        ) : (
          <>
            {/* Page header */}
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="step-number mb-1">Projects</p>
                <h1 className="text-2xl font-bold tracking-tight">Your Audits</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Select a project to continue or create a new one.
                </p>
              </div>
              <Button
                onClick={handleNewProject}
                className="gap-1.5 rounded-xl h-10 px-5 shadow-sm sm:hidden"
              >
                <Plus className="h-4 w-4" /> New
              </Button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              {/* Primary stat */}
              <Card className="border-0 overflow-hidden rounded-3xl relative">
                <div className="bg-gradient-green p-6 text-primary-foreground relative overflow-hidden">
                  <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-primary-foreground/10" />
                  <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-primary-foreground/5" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] uppercase tracking-widest opacity-75 font-semibold">
                        Total Projects
                      </p>
                      <div className="h-8 w-8 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
                        <BarChart2 className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-4xl font-bold font-mono">{projects.length}</p>
                    <p className="text-[11px] opacity-65 mt-1">Carbon audits</p>
                  </div>
                </div>
              </Card>

              <Card className="card-elevated border-0 rounded-3xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      AI Infrastructure
                    </p>
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <p className="text-4xl font-bold font-mono">{aiInfraCount}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Deploy-ready</p>
                </CardContent>
              </Card>

              <Card className="card-elevated border-0 rounded-3xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Regions Covered
                    </p>
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Globe className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <p className="text-4xl font-bold font-mono">{regionCount}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Unique regions</p>
                </CardContent>
              </Card>
            </div>

            {/* Projects grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((proj) => (
                <ProjectCard
                  key={proj.id}
                  proj={proj}
                  onOpen={openProject}
                  onDelete={handleDelete}
                />
              ))}

              {/* New project card */}
              <Card
                className="border-2 border-dashed border-border hover:border-primary/30 hover:bg-primary/[0.015] cursor-pointer transition-all flex items-center justify-center min-h-[160px] rounded-3xl group"
                onClick={handleNewProject}
              >
                <CardContent className="text-center py-8">
                  <div className="h-12 w-12 mx-auto rounded-2xl bg-primary/8 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-semibold text-sm">New Project</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Start a carbon audit</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ─── Project Card ─────────────────────────────────────────────────────── */

function ProjectCard({
  proj,
  onOpen,
  onDelete,
}: {
  proj: Project;
  onOpen: (proj: Project) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  const regionLabel = REGION_LABELS[proj.primaryRegion] ?? proj.primaryRegion?.replace(/_/g, " ") ?? "—";
  const isAiInfra = proj.companyType === "ai_infra";

  return (
    <Card
      className={cn(
        "card-elevated hover-lift border-0 cursor-pointer rounded-3xl group transition-all",
        "hover:ring-2 hover:ring-primary/15"
      )}
      onClick={() => onOpen(proj)}
    >
      <CardContent className="p-5">
        {/* Top row: title + actions */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[15px] truncate group-hover:text-primary transition-colors">
              {proj.name}
            </h3>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {proj.year}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {regionLabel}
              </span>
            </div>
          </div>

          {/* Delete button — always reachable, subtle until hover */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0 cursor-pointer"
                aria-label="Delete project"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{proj.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the project and all its data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => onDelete(e, proj.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Bottom row: type badge + baseline + arrow */}
        <div className="flex items-center gap-2 pt-3.5 border-t border-border/70">
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs rounded-full px-2.5 py-0.5 font-medium",
              isAiInfra
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isAiInfra ? <Sparkles className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
            {isAiInfra ? "AI Infra" : "Enterprise"}
          </div>

          {proj.baselineFootprintKgCO2e && (
            <span className="text-xs text-muted-foreground font-mono ml-auto mr-1">
              {formatTonnes(proj.baselineFootprintKgCO2e)} t
            </span>
          )}

          <ArrowRight
            className={cn(
              "h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all",
              !proj.baselineFootprintKgCO2e && "ml-auto"
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
