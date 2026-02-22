import { useProject } from "@/contexts/ProjectContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2, Sparkles, Building2 } from "lucide-react";
import { api } from "@/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Supported regions for home region and simulation/comparison (carbon footprint + compliance)
const REGIONS = [
  { value: "eu",      label: "EU (mixed grid — ~350 g/kWh)" },
  { value: "norway",  label: "Norway (Hydro — ~10 g/kWh)" },
  { value: "us",      label: "US (mixed grid — ~380 g/kWh)" },
  { value: "iceland", label: "Iceland (Geothermal — ~15 g/kWh)" },
];

const REGION_CARBON: Record<string, string> = {
  eu:      "~350 g/kWh — mixed European grid",
  norway:  "~10 g/kWh — primarily hydro",
  us:      "~380 g/kWh — mixed US grid",
  iceland: "~15 g/kWh — geothermal dominant",
};

export default function Setup() {
  const { project, updateProject } = useProject();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [companyType, setCompanyType] = useState<"ai_infra" | "other">("other");

  const toggleComparison = (region: string) => {
    const current = project.comparisonRegions;
    if (current.includes(region)) {
      updateProject({ comparisonRegions: current.filter((r) => r !== region) });
    } else {
      updateProject({ comparisonRegions: [...current, region] });
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const created = await api.createProject({
        name: project.projectName,
        year: project.year,
        companyType,
        primaryRegion: project.primaryRegion,
        comparisonRegions: project.comparisonRegions,
      });
      updateProject({
        currentProjectId: created.id,
        regions: [project.primaryRegion, ...project.comparisonRegions],
      });
      navigate("/upload");
    } finally {
      setLoading(false);
    }
  };

  const canCreate = project.projectName.trim() && project.primaryRegion;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up pb-24">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="step-number mb-1">Step 01</p>
          <h1 className="text-2xl font-bold tracking-tight">Project Setup</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure your carbon audit project parameters.</p>
        </div>
        {/* Auto-save badge */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1 mt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          AUTO-SAVE ENABLED
        </div>
      </div>

      <Card className="card-elevated border-0">
        <CardHeader>
          <CardTitle className="text-lg">General Information</CardTitle>
          <CardDescription>Define the scope of this audit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Project Name</Label>
            <Input
              value={project.projectName}
              onChange={(e) => updateProject({ projectName: e.target.value })}
              placeholder="e.g. Abilene Data Center Expansion"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label>Company Type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCompanyType("ai_infra")}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all border cursor-pointer",
                  companyType === "ai_infra"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI Infrastructure
              </button>
              <button
                type="button"
                onClick={() => setCompanyType("other")}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all border cursor-pointer",
                  companyType === "other"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                Other
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reporting Year</Label>
            <Select value={String(project.year)} onValueChange={(v) => updateProject({ year: Number(v) })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Primary Region</Label>
            <Select value={project.primaryRegion} onValueChange={(v) => updateProject({ primaryRegion: v })}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select primary region" /></SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {project.primaryRegion && REGION_CARBON[project.primaryRegion] && (
              <p className="text-xs text-muted-foreground pl-1">{REGION_CARBON[project.primaryRegion]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Comparison Regions (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Simulate carbon impact in other regions or verify compliance if infrastructure were built there.
            </p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.filter((r) => r.value !== project.primaryRegion).map((r) => (
                <Badge
                  key={r.value}
                  variant={project.comparisonRegions.includes(r.value) ? "default" : "outline"}
                  className="cursor-pointer select-none transition-all hover:scale-105"
                  onClick={() => toggleComparison(r.value)}
                >
                  {r.label.split(" (")[0]}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Baseline Footprint (kg CO₂e, optional)</Label>
            <Input
              type="number"
              value={project.baselineFootprintKgCO2e ?? ""}
              onChange={(e) =>
                updateProject({
                  baselineFootprintKgCO2e: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="e.g. 1200000"
              className="h-11"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sticky footer */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-md border-t border-border md:ml-[272px]">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-5 py-4">
          <Button variant="outline" onClick={() => navigate("/app")} className="gap-2 rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate || loading} size="lg" className="gap-2 rounded-xl px-6">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save & Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
