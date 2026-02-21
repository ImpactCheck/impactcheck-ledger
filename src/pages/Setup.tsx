import { useProject } from "@/contexts/ProjectContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2, Leaf } from "lucide-react";
import { api } from "@/api";
import { Badge } from "@/components/ui/badge";

const REGIONS = [
{ value: "texas_ercot", label: "Texas (ERCOT — 380 g/kWh)" },
{ value: "norway_hydro", label: "Norway (Hydro — 10 g/kWh)" },
{ value: "virginia_pjm", label: "Virginia (PJM — 310 g/kWh)" },
{ value: "iowa_miso", label: "Iowa (MISO — 420 g/kWh)" },
{ value: "iceland_geo", label: "Iceland (Geothermal — 15 g/kWh)" },
{ value: "singapore", label: "Singapore (408 g/kWh)" }];


export default function Setup() {
  const { project, updateProject } = useProject();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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
        companyType: project.companyType === "ai_infra" ? "ai_infra" : "other",
        primaryRegion: project.primaryRegion,
        comparisonRegions: project.comparisonRegions
      });
      updateProject({
        currentProjectId: created.id,
        regions: [project.primaryRegion, ...project.comparisonRegions]
      });
      navigate("/upload");
    } finally {
      setLoading(false);
    }
  };

  const canCreate = project.projectName.trim() && project.primaryRegion;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
      {/* Page header */}
      <div className="flex items-center gap-4">
        


        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Setup</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Configure your carbon audit project parameters.</p>
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
              className="h-11" />

          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reporting Year</Label>
              <Select value={String(project.year)} onValueChange={(v) => updateProject({ year: Number(v) })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) =>
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Company Type</Label>
              <Select value={project.companyType} onValueChange={(v) => updateProject({ companyType: v as any })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai_infra">AI Infrastructure</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="startup">Startup</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Primary Region</Label>
            <Select value={project.primaryRegion} onValueChange={(v) => updateProject({ primaryRegion: v })}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select primary region" /></SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) =>
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Comparison Regions (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {REGIONS.filter((r) => r.value !== project.primaryRegion).map((r) =>
              <Badge
                key={r.value}
                variant={project.comparisonRegions.includes(r.value) ? "default" : "outline"}
                className="cursor-pointer select-none transition-all hover:scale-105"
                onClick={() => toggleComparison(r.value)}>

                  {r.label.split(" (")[0]}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Baseline Footprint (kg CO₂e, optional)</Label>
            <Input
              type="number"
              value={project.baselineFootprintKgCO2e ?? ""}
              onChange={(e) =>
              updateProject({
                baselineFootprintKgCO2e: e.target.value ? Number(e.target.value) : undefined
              })
              }
              placeholder="e.g. 1200000"
              className="h-11" />

          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleCreate} disabled={!canCreate || loading} size="lg" className="gap-2 rounded-xl px-6">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create Project <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>);

}