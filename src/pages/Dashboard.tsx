import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import type { Project } from "@/contracts/impactcheck.v2";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus, MapPin, Calendar, Building2, ArrowRight, Sun, Moon,
  Trash2, BarChart2, Globe, Leaf, Sparkles, Users, Download, FileSpreadsheet,
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

import { REGION_LABELS } from "@/lib/regions";
import {
  useProjectStepCompletions,
  getProgressFromCompletion,
  type StepCompletion,
} from "@/hooks/useStepCompletion";



export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateProject } = useProject();
  const { theme, toggleTheme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listProjects().then((p) => { setProjects(p); setLoading(false); });
  }, []);

  const stepCompletions = useProjectStepCompletions(projects);

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

  const businessCount = projects.filter((p) => p.companyType === "business").length;
  const regionCount = new Set(
    projects.flatMap((p) => [p.primaryRegion, ...(p.comparisonRegions ?? [])])
  ).size;

  const isEmpty = !loading && projects.length === 0;

  return (
    <div className="min-h-screen bg-background bg-mesh-green">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <img src={logoImg} alt="ImpactCheck" className="h-9 w-9 object-contain" />
            <span className="text-base font-bold tracking-tight">ImpactCheck</span>
          </button>
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

            {/* ── Sample data card ────────────────────────────── */}
            <Card className="card-elevated border-0 rounded-3xl mt-10 w-full max-w-md text-left">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1">Want to try it out first?</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                      Download our sample input document — a pre-construction resource &amp; energy
                      estimate for a Nordic AI data center — then upload it to see how ImpactCheck
                      extracts activities and calculates carbon emissions.
                    </p>
                    <a
                      href="/sample/Crusoe_Polar_Hamar_ImpactCheck_Sample.pdf"
                      download
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-xl h-8 text-xs"
                      >
                        <Download className="h-3.5 w-3.5" /> Download Sample PDF
                      </Button>
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                      Business
                    </p>
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <p className="text-4xl font-bold font-mono">{businessCount}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Business projects</p>
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
                  completion={stepCompletions[proj.id]}
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

            {/* ── Getting started hint (anonymous / demo users) ── */}
            {!user && (
              <Card className="card-elevated border-0 rounded-3xl mt-8">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm mb-1">Run your own audit</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        Create a new project and upload your own data — or use our sample input
                        document to walk through the full workflow yourself. You can also explore one
                        of the example projects above to see pre-populated results.
                      </p>
                      <a
                        href="/sample/Crusoe_Polar_Hamar_ImpactCheck_Sample.pdf"
                        download
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 rounded-xl h-8 text-xs"
                        >
                          <Download className="h-3.5 w-3.5" /> Download Sample PDF
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ─── Project Card ─────────────────────────────────────────────────────── */

function ProjectCard({
  proj,
  completion,
  onOpen,
  onDelete,
}: {
  proj: Project;
  completion?: StepCompletion;
  onOpen: (proj: Project) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  const regionLabel = REGION_LABELS[proj.primaryRegion] ?? proj.primaryRegion?.replace(/_/g, " ") ?? "—";
  const typeLabel = { business: "Business", investor: "Investor", regulator: "Regulator" }[proj.companyType] ?? proj.companyType;
  const progressPct = completion ? getProgressFromCompletion(completion) : 0;
  const isCompleted = progressPct >= 100;

  return (
    <Card
      className={cn(
        "card-elevated hover-lift border-0 cursor-pointer rounded-3xl group transition-all",
        "hover:ring-2 hover:ring-primary/15"
      )}
      onClick={() => onOpen(proj)}
    >
      <CardContent className="p-5">
        {/* Top row: title + status + delete */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={isCompleted ? "status-completed" : "status-in-progress"}>
                {isCompleted ? "COMPLETED" : "IN PROGRESS"}
              </span>
              <div className="flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 font-medium bg-primary/10 text-primary">
                <Building2 className="h-2.5 w-2.5" />
                {typeLabel}
              </div>
            </div>
            <h3 className="font-semibold text-[15px] truncate group-hover:text-primary transition-colors">
              {proj.name}
            </h3>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
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

          {/* Delete button */}
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

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground font-mono">Progress</span>
            <span className="text-[10px] text-muted-foreground font-mono">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Bottom row: team avatars + baseline + action */}
        <div className="flex items-center gap-2 pt-3 border-t border-border/70">
          {/* Static team avatars */}
          <div className="flex items-center -space-x-2">
            <div className="h-6 w-6 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center">
              <span className="text-[8px] font-bold text-primary">AM</span>
            </div>
            <div className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center">
              <Users className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
          </div>

          {proj.baselineFootprintKgCO2e && (
            <span className="text-xs text-muted-foreground font-mono">
              {formatTonnes(proj.baselineFootprintKgCO2e)} t
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {isCompleted ? (
              <span className="text-xs text-primary font-medium flex items-center gap-1">
                View Report <ArrowRight className="h-3 w-3" />
              </span>
            ) : (
              <span className="text-xs text-primary font-medium flex items-center gap-1">
                Resume Audit <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
