import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, AlertTriangle, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { Report as ReportType } from "@/contracts/impactcheck.v2";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import { AuditCertificate } from "@/components/AuditCertificate";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const CATEGORY_COLORS = [
  "hsl(152 52% 40%)",
  "hsl(200 70% 50%)",
  "hsl(30 80% 55%)",
  "hsl(280 60% 55%)",
  "hsl(350 70% 55%)",
  "hsl(60 70% 45%)",
];

export default function Report() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId;
  const [report, setReport] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      setError("No project selected. Please set up a project first.");
      return;
    }
    setLoading(true);
    api.getReport(projectId)
      .then(setReport)
      .catch((e) => setError(e.message ?? "Failed to load report"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground">Loading report…</p>
    </div>
  );

  if (error || !report) return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <Card className="card-elevated border-0">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-medium">{error ?? "No report data available."}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Complete the Setup, Upload, Activities, and Mapping steps before viewing the report.
          </p>
          <Button variant="outline" onClick={() => navigate("/setup")} className="mt-4 gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Go to Setup
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const primaryRegion = Object.keys(report.totalsByRegion)[0] ?? "";
  const primaryTotal = report.totalsByRegion[primaryRegion] ?? 0;
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  const regionCompareData = Object.entries(report.totalsByRegion).map(
    ([region, total]) => ({ region: region.replace(/_/g, " "), total })
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 print:space-y-4 print:max-w-none print:p-0 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carbon Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Full lifecycle carbon assessment.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 rounded-xl">
            <Printer className="h-3.5 w-3.5" /> Print / Export
          </Button>
          <AuditCertificate report={report} projectName={project.projectName} primaryRegion={primaryRegion} />
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">ImpactCheck — Carbon Report</h1>
        <p className="text-sm">{project.projectName} · {project.year} · {primaryRegion.replace(/_/g, " ")}</p>
      </div>

      {/* Hero total */}
      <Card className="card-elevated border-0 overflow-hidden print:border print:shadow-none">
        <div className="bg-gradient-green p-6 text-primary-foreground">
          <p className="text-xs uppercase tracking-wider opacity-80">Total Lifecycle Carbon — {primaryRegion.replace(/_/g, " ")}</p>
          <p className="text-4xl font-bold font-mono mt-2">
            {formatTonnes(primaryTotal)} <span className="text-lg font-normal opacity-70">tonnes CO₂e</span>
          </p>
          {report.deltaVsBaselineKg !== undefined && (
            <p className="text-sm mt-1.5 opacity-80">
              {report.deltaVsBaselineKg > 0 ? "+" : ""}{formatTonnes(report.deltaVsBaselineKg)} t vs. baseline
            </p>
          )}
        </div>
        <CardContent className="pt-4 pb-4 flex gap-3">
          <ComplianceBadge level={report.compliance.us.status} />
          <ComplianceBadge level={report.compliance.eu.status} />
        </CardContent>
      </Card>

      {/* Compliance detail */}
      <Card className="card-elevated border-0 print:border print:shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Regulatory Compliance</CardTitle>
          <CardDescription>US and EU compliance assessment with reasons.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ComplianceBadge level={report.compliance.us.status} />
                <span className="text-sm font-semibold">US (EPA)</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 ml-1">
                {report.compliance.us.reasons.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ComplianceBadge level={report.compliance.eu.status} />
                <span className="text-sm font-semibold">EU (CSRD)</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 ml-1">
                {report.compliance.eu.reasons.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
        <Card className="card-elevated border-0 print:border print:shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Category Breakdown</CardTitle>
            <CardDescription>Emissions by category for {primaryRegion.replace(/_/g, " ")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="category" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatTonnes(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(40 15% 90%)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    formatter={(value: number) => [`${formatTonnes(value)} t CO₂e`, ""]}
                  />
                  <Bar dataKey="co2eKg" radius={[6, 6, 0, 0]}>
                    {categories.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {regionCompareData.length > 1 && (
          <Card className="card-elevated border-0 print:border print:shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">Region Comparison</CardTitle>
              <CardDescription>Total CO₂e by region</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionCompareData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="region" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatTonnes(v)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(40 15% 90%)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                      formatter={(value: number) => [`${formatTonnes(value)} t CO₂e`, ""]}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="hsl(152 52% 40%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Hotspots */}
      <Card className="card-elevated border-0 print:border print:shadow-none">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Top Hotspots
          </CardTitle>
          <CardDescription>Highest-emission activities requiring attention.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {report.hotspots.slice(0, 10).map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 text-sm hover:bg-muted/60 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono w-5">{i + 1}.</span>
                  <span className="font-medium">{h.text}</span>
                </div>
                <span className="font-mono font-bold text-primary">{formatTonnes(h.co2eKg)} t</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between print:hidden">
        <Button variant="outline" onClick={() => navigate("/mapping")} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => navigate("/recommendations")} className="gap-2 rounded-xl">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
