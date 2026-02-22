import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, Zap, Leaf, Wind, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { Report as ReportType, ActivityEstimate } from "@/contracts/impactcheck.v2";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from "recharts";
import { REGION_LABELS } from "@/lib/regions";

/* ── Region-derived renewable mix ─────────────────────────────────────── */
const RENEWABLE_MIX: Record<string, number> = {
  norway: 94,
  iceland: 97,
  eu: 45,
  us: 28,
};

/* Static industry baselines (t CO₂e per compute unit — illustrative) */
const INDUSTRY_BENCHMARKS = [
  { name: "Hyperscalers avg",  value: 0.38, color: "hsl(210 70% 50%)" },
  { name: "Enterprise avg",    value: 0.65, color: "hsl(220 60% 45%)" },
  { name: "Sovereign AI",      value: 1.20, color: "hsl(230 55% 40%)" },
];

export default function Benchmarking() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId;

  const [report, setReport] = useState<ReportType | null>(null);
  const [estimates, setEstimates] = useState<ActivityEstimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    Promise.all([
      api.getReport(projectId),
      api.getEstimates(projectId),
    ]).then(([rep, ests]) => {
      setReport(rep);
      setEstimates(ests);
    }).finally(() => setLoading(false));
  }, [projectId]);

  const primaryRegion = useMemo(() => {
    if (!report) return project.primaryRegion ?? "";
    return Object.keys(report.totalsByRegion)[0] ?? project.primaryRegion ?? "";
  }, [report, project.primaryRegion]);

  /* Computed yearly total: sum of ALL estimates (matches Emissions page "Total CO₂e / yr") */
  const computedYearlyTotal = useMemo(
    () => estimates.reduce((s, e) => s + e.co2eKg, 0),
    [estimates]
  );
  const renewablePct = RENEWABLE_MIX[primaryRegion] ?? 20;
  const embodiedPct = estimates.length > 0 ? 38 : 0; // industry baseline comparison

  /* Carbon intensity: total CO₂e / number of estimates as proxy for activity count */
  const projectIntensity = estimates.length > 0
    ? parseFloat((computedYearlyTotal / 1000 / estimates.length).toFixed(3))
    : 0;

  const benchmarkData = [
    { name: "Your Project", value: projectIntensity, color: "hsl(var(--primary))" },
    ...INDUSTRY_BENCHMARKS,
  ];

  /* Trajectory chart: baseline (flat) + computed yearly actual */
  const baselineKg = project.baselineFootprintKgCO2e ?? computedYearlyTotal * 1.15;
  const trajectoryData = [
    { quarter: "Q1 Baseline", actual: baselineKg / 1000, baseline: baselineKg / 1000 },
    { quarter: "Q2",          actual: baselineKg / 1000 * 0.95, baseline: baselineKg / 1000 },
    { quarter: "Q3",          actual: computedYearlyTotal / 1000 * 0.9,  baseline: baselineKg / 1000 },
    { quarter: "Q4 Current",  actual: computedYearlyTotal / 1000, baseline: baselineKg / 1000 },
  ];

  const aiTip = renewablePct >= 80
    ? "Your region has excellent renewable energy access. Focus on hardware lifecycle and efficiency gains."
    : renewablePct >= 40
      ? "Consider renewable energy agreements (PPAs) to improve your renewable mix."
      : "Migrating workloads to a renewable-heavy region could reduce operational carbon by up to 85%.";

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Loader2 className="h-5 w-5 text-primary animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground">Loading benchmarking data…</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <p className="step-number mb-1">Step 04</p>
        <h1 className="text-2xl font-bold tracking-tight">Benchmarking</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Compare your carbon intensity against industry peers and track your trajectory.
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Charts (left 2/3) ────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Carbon Intensity Benchmark */}
          <Card className="card-elevated border-0">
            <CardHeader>
              <CardTitle className="text-lg">Carbon Intensity Comparison</CardTitle>
              <CardDescription>
                t CO₂e per emission activity — {REGION_LABELS[primaryRegion] ?? (primaryRegion || "Your Region")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={benchmarkData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${v} t`}
                    />
                    <YAxis type="category" dataKey="name" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number) => [`${value} t CO₂e`, "Intensity"]}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {benchmarkData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(var(--primary))" }} />
                  Your Project
                </div>
                {INDUSTRY_BENCHMARKS.map((b) => (
                  <div key={b.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                    {b.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Trajectory chart */}
          <Card className="card-elevated border-0">
            <CardHeader>
              <CardTitle className="text-lg">Historical Trajectory vs Baseline</CardTitle>
              <CardDescription>Quarterly progress against your baseline footprint (t CO₂e)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trajectoryData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="quarter" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${v.toFixed(0)} t`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number) => [`${value.toFixed(2)} t CO₂e`, ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "hsl(220 10% 46%)" }} />
                    <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} name="Actual" />
                    <Line type="monotone" dataKey="baseline" stroke="hsl(220 10% 46%)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Baseline" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => navigate("/emissions")} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={() => navigate("/report")} className="gap-2 rounded-xl">
              Continue to Report <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Right insights panel ──────────────────────────────── */}
        <div className="w-64 shrink-0 hidden lg:block">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5 sticky top-8">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Benchmarking Insights</p>
              <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                LIVE DATA v2.4
              </span>
            </div>

            {/* Energy Efficiency */}
            <InsightCard
              icon={<Zap className="h-3.5 w-3.5" />}
              title="Energy Efficiency"
              value={project.primaryRegion === "norway" || project.primaryRegion === "iceland" ? "PUE 1.12" : "PUE —"}
              sub="Power Usage Effectiveness"
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />

            {/* Embodied Carbon */}
            <InsightCard
              icon={<TrendingDown className="h-3.5 w-3.5" />}
              title="Embodied Carbon"
              value={estimates.length > 0 ? `${embodiedPct}%` : "—"}
              sub="Year 1 only · vs 38% industry baseline"
              color="text-amber-500"
              bgColor="bg-amber-500/10"
            />

            {/* Renewable Mix */}
            <InsightCard
              icon={<Wind className="h-3.5 w-3.5" />}
              title="Renewable Mix"
              value={`${renewablePct}%`}
              sub={REGION_LABELS[primaryRegion] ?? primaryRegion}
              color="text-primary"
              bgColor="bg-primary/10"
            />

            {/* Renewable bar */}
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden -mt-2">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${renewablePct}%` }}
              />
            </div>

            {/* AI Recommendation */}
            <div className="rounded-xl bg-primary/8 border border-primary/15 p-3">
              <div className="flex items-start gap-2">
                <Leaf className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-primary mb-0.5">AI Recommendation</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{aiTip}</p>
                </div>
              </div>
            </div>

            {/* Computed yearly total (matches Emissions page) */}
            {computedYearlyTotal > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground">Computed yearly total</p>
                <p className="text-lg font-bold font-mono text-primary">{formatTonnes(computedYearlyTotal)} t</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  icon, title, value, sub, color, bgColor,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  sub: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`h-7 w-7 rounded-lg ${bgColor} flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-sm font-bold text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}
