import { useProject } from "@/contexts/ProjectContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

const REGIONS = ["Texas (ERCOT)", "Norway (Hydro)", "Virginia (PJM)", "California (CAISO)", "Iceland (Geothermal)"];

export default function Setup() {
  const { project, updateProject } = useProject();
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Setup</h1>
        <p className="text-muted-foreground mt-1">Configure your carbon audit project parameters.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">General Information</CardTitle>
          <CardDescription>Define the scope of this audit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Project Name</Label>
            <Input
              value={project.projectName}
              onChange={(e) => updateProject({ projectName: e.target.value })}
              placeholder="e.g. Abilene Data Center Expansion"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reporting Year</Label>
              <Select
                value={String(project.year)}
                onValueChange={(v) => updateProject({ year: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Company Type</Label>
              <Select
                value={project.companyType}
                onValueChange={(v) => updateProject({ companyType: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Label>Region(s)</Label>
            <Select
              value={project.regions[0] || ""}
              onValueChange={(v) => updateProject({ regions: [v] })}
            >
              <SelectTrigger><SelectValue placeholder="Select primary region" /></SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => navigate("/upload")} className="gap-2">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
