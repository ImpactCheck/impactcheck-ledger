import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, AlertTriangle, Printer, Loader2, Building2, Zap, Leaf, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { Report as ReportType } from "@/contracts/impactcheck.v2";
import { formatTonnes, getActivityPhase } from "@/contracts/impactcheck.v2";
import { AuditCertificate } from "@/components/AuditCertificate";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";

const EMBODIED_COLOR = "hsl(30 80% 55%)";
const OPERATIONAL_COLOR = "hsl(200 70% 50%)";

const CATEGORY_COLORS: Record<string, string> = {};
function getCategoryColor(category: string): string {
  const phase = getActivityPhase(category);
  if (!CATEGORY_COLORS[category]) {
    const embodiedPalette = ["hsl(30 80% 55%)", "hsl(35 75% 50%)", "hsl(25 70% 45%)", "hsl(40 65% 60%)"];
    const operationalPalette = ["hsl(200 70% 50%)", "hsl(210 65% 55%)", "hsl(190 60% 45%)", "hsl(180 55% 50%)", "hsl(220 60% 55%)"];
    const palette = phase === "embodied" ? embodiedPalette : operationalPalette;
    const existing = Object.keys(CATEGORY_COLORS).filter((k) => getActivityPhase(k) === phase).length;
    CATEGORY_COLORS[category] = palette[existing % palette.length];
  }
  return CATEGORY_COLORS[category];
}

const RENEWABLE_MIX: Record<string, number> = {
  norway_hydro: 94,
  iceland_geo:  97,
  iowa_miso:    42,
  virginia_pjm: 35,
  texas_ercot:  28,
  singapore:    4,
};

const REGION_LABELS: Record<string, string> = {
  texas_ercot:  "Texas (ERCOT)",
  norway_hydro: "Norway (Hydro)",
  virginia_pjm: "Virginia (PJM)",
  iowa_miso:    "Iowa (MISO)",
  iceland_geo:  "Iceland (Geo)",
  singapore:    "Singapore",
};

function ComplianceStatusCard({
  label,
  status,
  reasons,
}: {
  label: string;
  status: "green" | "yellow" | "red" | "PENDING";
  reasons: string[];
}) {
  const isReady = status === "green";
  const isAction = status === "yellow" || status === "red";
  const displayLabel = isReady ? "READY" : isAction ? "ACTION NEEDED" : "PENDING";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold">{label}</span>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border font-mono",
            isReady && "text-primary bg-primary/10 border-primary/25",
            isAction && "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800",
            !isReady && !isAction && "text-muted-foreground bg-muted border-border"
          )}
        >
          {displayLabel}
        </span>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1.5">
        {reasons.map((r, i) => <li key={i}>• {r}</li>)}
      </ul>
    </div>
  );
}

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

  const phaseTotals = useMemo(() => {
    if (!report?.categoryBreakdownByRegion) return null;
    const primaryRegion = Object.keys(report.totalsByRegion)[0] ?? "";
    const categories = report.categoryBreakdownByRegion[primaryRegion] ?? [];
    let embodied = 0;
    let operational = 0;
    for (const c of categories) {
      if (getActivityPhase(c.category) === "embodied") embodied += c.co2eKg;
      else operational += c.co2eKg;
    }
    return { embodied, operational };
  }, [report]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-primary animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground">Building your carbon report…</p>
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
  const renewablePct = RENEWABLE_MIX[primaryRegion] ?? 20;
  const carbonOffset = parseFloat((primaryTotal / 1000 * 0.49).toFixed(1));
  const sciScore = categories.length > 0 ? (primaryTotal / 1000 / categories.length).toFixed(2) : "—";
  const topHotspot = report.hotspots?.[0]?.text ?? "compute workloads";

  return (
    <div className="max-w-5xl mx-auto space-y-6 print:space-y-4 print:max-w-none print:p-0 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <p className="step-number mb-1">Step 06</p>
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

      {/* ── 4 metric header cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <MetricCard
          label="Total Lifecycle Carbon"
          value={`${formatTonnes(primaryTotal)} t`}
          sub="CO₂e lifecycle"
          icon={<Leaf className="h-4 w-4" />}
          accent
        />
        <MetricCard
          label="SCI Score"
          value={typeof sciScore === "string" ? sciScore : `${sciScore} t`}
          sub="t CO₂e per category"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <MetricCard
          label="Renewable Mix"
          value={`${renewablePct}%`}
          sub={REGION_LABELS[primaryRegion] ?? primaryRegion}
          icon={<Zap className="h-4 w-4" />}
        />
        <MetricCard
          label="Carbon Offset"
          value={`${carbonOffset} t`}
          sub="50% offset estimate"
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>

      {/* Hero total (print + desktop) */}
      <Card className="card-elevated border-0 overflow-hidden print:border print:shadow-none">
        <div className="bg-gradient-green p-6 text-primary-foreground">
          <p className="text-xs uppercase tracking-wider opacity-80">
            Total Lifecycle Carbon — {REGION_LABELS[primaryRegion] ?? primaryRegion.replace(/_/g, " ")}
          </p>
          <p className="text-4xl font-bold font-mono mt-2">
            {formatTonnes(primaryTotal)} <span className="text-lg font-normal opacity-70">tonnes CO₂e</span>
          </p>
          {report.deltaVsBaselineKg !== undefined && (
            <p className="text-sm mt-1.5 opacity-80">
              {report.deltaVsBaselineKg > 0 ? "+" : ""}{formatTonnes(report.deltaVsBaselineKg)} t vs. baseline
            </p>
          )}
        </div>
      </Card>

      {/* AI Insight box */}
      <div className="rounded-2xl bg-primary/8 border border-primary/20 px-5 py-4 flex items-start gap-3 print:hidden">
        <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-primary font-mono">AI</span>
        </div>
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">AI Insight</p>
          <p className="text-sm text-foreground">
            Migrating <span className="font-semibold">{topHotspot}</span> to a renewable energy region could reduce total carbon by up to{" "}
            <span className="font-semibold text-primary">15%</span>.
          </p>
        </div>
      </div>

      {/* Embodied vs Operational split */}
      {phaseTotals && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="card-elevated border-0 print:border print:shadow-none">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(30 80% 55% / 0.15)" }}>
                  <Building2 className="h-5 w-5" style={{ color: EMBODIED_COLOR }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Embodied Carbon</p>
                  <p className="text-2xl font-bold font-mono">
                    {formatTonnes(phaseTotals.embodied)} <span className="text-sm font-normal text-muted-foreground">t CO₂e</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">One-time · construction & hardware</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-elevated border-0 print:border print:shadow-none">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(200 70% 50% / 0.15)" }}>
                  <Zap className="h-5 w-5" style={{ color: OPERATIONAL_COLOR }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Operational Carbon</p>
                  <p className="text-2xl font-bold font-mono">
                    {formatTonnes(phaseTotals.operational)} <span className="text-sm font-normal text-muted-foreground">t CO₂e</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">Per year · energy & operations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Compliance Status cards */}
      <Card className="card-elevated border-0 print:border print:shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Regulatory Compliance</CardTitle>
          <CardDescription>Assessment status by framework.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ComplianceStatusCard
              label="EU CSRD"
              status={report.compliance.eu.status}
              reasons={report.compliance.eu.reasons}
            />
            <ComplianceStatusCard
              label="US SEC Climate"
              status={report.compliance.us.status}
              reasons={report.compliance.us.reasons}
            />
            <ComplianceStatusCard
              label="ISO 14064"
              status={"PENDING" as "green" | "yellow" | "red" | "PENDING"}
              reasons={["Verification audit not yet scheduled", "Data collection in progress"]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
        <Card className="card-elevated border-0 print:border print:shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Category Breakdown</CardTitle>
            <CardDescription>Emissions by category for {REGION_LABELS[primaryRegion] ?? primaryRegion.replace(/_/g, " ")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="category" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatTonnes(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(value: number) => [`${formatTonnes(value)} t CO₂e`, ""]}
                  />
                  <Bar dataKey="co2eKg" radius={[6, 6, 0, 0]}>
                    {categories.map((c, i) => <Cell key={i} fill={getCategoryColor(c.category)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EMBODIED_COLOR }} />
                Embodied
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: OPERATIONAL_COLOR }} />
                Operational
              </div>
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
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number) => [`${formatTonnes(value)} t CO₂e`, ""]}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
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
                  {h.phase && (
                    <Badge
                      className={`text-[10px] rounded-full ${
                        h.phase === "embodied"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          : "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                      }`}
                    >
                      {h.phase === "embodied" ? "Embodied" : "Operational"}
                    </Badge>
                  )}
                </div>
                <span className="font-mono font-bold text-primary">{formatTonnes(h.co2eKg)} t</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between print:hidden">
        <Button variant="outline" onClick={() => navigate("/benchmarking")} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => navigate("/recommendations")} className="gap-2 rounded-xl">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, sub, icon, accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl p-4 border",
      accent
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card border-border"
    )}>
      <div className="flex items-center justify-between mb-3">
        <p className={cn(
          "text-[10px] font-semibold uppercase tracking-widest",
          accent ? "opacity-75" : "text-muted-foreground"
        )}>
          {label}
        </p>
        <div className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center",
          accent ? "bg-primary-foreground/15" : "bg-primary/10 text-primary"
        )}>
          {icon}
        </div>
      </div>
      <p className={cn("text-2xl font-bold font-mono", accent ? "" : "text-foreground")}>{value}</p>
      <p className={cn("text-[11px] mt-0.5", accent ? "opacity-70" : "text-muted-foreground")}>{sub}</p>
    </div>
  );
}
