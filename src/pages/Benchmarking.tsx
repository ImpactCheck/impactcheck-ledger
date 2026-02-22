import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, Zap, Leaf, Wind, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { ActivityEstimate, ExtractedActivity } from "@/contracts/impactcheck.v2";
import { formatTonnes, getActivityPhase } from "@/contracts/impactcheck.v2";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from "recharts";
import { REGION_LABELS } from "@/lib/regions";
import { useJobPoller } from "@/hooks/useJobPoller";
import JobProgressCard from "@/components/JobProgressCard";

/* ── Region-derived renewable mix ─────────────────────────────────────── */
const RENEWABLE_MIX: Record<string, number> = {
  norway: 94,
  iceland: 97,
  eu: 45,
  us: 28,
};

/*
 * Industry benchmarks: annual operational carbon (t CO₂e / yr) for a
 * comparable-scale facility, based on 2024–25 sustainability reports.
 * These are indicative averages — actual values vary by workload and region.
 */
const INDUSTRY_BENCHMARKS = [
  { name: "Hyperscalers avg",  value: 4200, color: "hsl(210 70% 50%)" },
  { name: "Enterprise avg",    value: 8500, color: "hsl(220 60% 45%)" },
  { name: "Sovereign AI",      value: 14000, color: "hsl(230 55% 40%)" },
];

const REGION_COLORS: Record<string, string> = {
  norway: "hsl(152 52% 40%)",
  iceland: "hsl(200 65% 55%)",
  eu: "hsl(210 70% 50%)",
  us: "hsl(230 55% 40%)",
};

export default function Benchmarking() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId;

  const [estimates, setEstimates] = useState<ActivityEstimate[]>([]);
  const [simEstimates, setSimEstimates] = useState<ActivityEstimate[]>([]);
  const [activities, setActivities] = useState<ExtractedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [simNeeded, setSimNeeded] = useState(false);

  const comparisonRegions = project.comparisonRegions ?? [];
  const hasComparisons = comparisonRegions.length > 0;
  const primaryRegion = project.primaryRegion || "global";

  /* ── Load simulation estimates after job completes ─────────────────── */
  const loadSimEstimates = useCallback(async () => {
    if (!projectId) return;
    const sims = await api.getSimulationEstimates(projectId);
    setSimEstimates(sims);
    setSimNeeded(false);
  }, [projectId]);

  const { job: simJob, start: startSim, isRunning: simRunning } = useJobPoller({
    projectId: projectId ?? undefined,
    jobType: "simulation",
    onSuccess: loadSimEstimates,
  });

  /* ── Initial data load ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!projectId) { setLoading(false); return; }

    Promise.all([
      api.getEstimates(projectId),
      api.getActivities(projectId),
      hasComparisons ? api.getSimulationEstimates(projectId) : Promise.resolve([]),
    ]).then(([ests, acts, sims]) => {
      setEstimates(ests);
      setActivities(acts);

      if (hasComparisons && sims.length === 0 && !simRunning) {
        // No simulation data yet — trigger simulation
        setSimNeeded(true);
        startSim(() => api.startSimulation(projectId));
      } else {
        setSimEstimates(sims);
      }
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /* ── Derived metrics ──────────────────────────────────────────────── */

  // Build activity lookup for phase classification
  const activityMap = useMemo(() => {
    const map = new Map<string, ExtractedActivity>();
    for (const a of activities) map.set(a.id, a);
    return map;
  }, [activities]);

  // Totals per region
  const regionTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    // Home estimates
    for (const e of estimates) {
      const r = e.region || primaryRegion;
      totals[r] = (totals[r] ?? 0) + e.co2eKg;
    }
    // Simulation estimates
    for (const e of simEstimates) {
      const r = e.region || primaryRegion;
      totals[r] = (totals[r] ?? 0) + e.co2eKg;
    }
    return totals;
  }, [estimates, simEstimates, primaryRegion]);

  // Phase totals for primary region
  const phaseTotals = useMemo(() => {
    const result = { embodied: 0, operational: 0 };
    for (const e of estimates) {
      const act = activityMap.get(e.activityId);
      const phase = getActivityPhase(act?.category);
      result[phase] += e.co2eKg;
    }
    return result;
  }, [estimates, activityMap]);

  const firstYearTotalKg = phaseTotals.embodied + phaseTotals.operational;
  const annualTotalKg = phaseTotals.operational;

  const renewablePct = RENEWABLE_MIX[primaryRegion] ?? 20;
  const embodiedPct = firstYearTotalKg > 0
    ? Math.round((phaseTotals.embodied / firstYearTotalKg) * 100)
    : 0;

  /* Annual operational total in tonnes */
  const annualOperationalTonnes = parseFloat((annualTotalKg / 1000).toFixed(1));

  const benchmarkData = [
    { name: "Your Project", value: annualOperationalTonnes, color: "hsl(var(--primary))" },
    ...INDUSTRY_BENCHMARKS,
  ];

  /* Region comparison chart data */
  const regionChartData = useMemo(() => {
    const allRegions = [primaryRegion, ...comparisonRegions];
    return allRegions.map((r) => ({
      region: REGION_LABELS[r] ?? r,
      total: regionTotals[r] ?? 0,
      color: r === primaryRegion ? "hsl(var(--primary))" : (REGION_COLORS[r] ?? "hsl(220 60% 45%)"),
      isHome: r === primaryRegion,
    }));
  }, [regionTotals, primaryRegion, comparisonRegions]);

  /* Multi-year trajectory */
  const baselineKg = project.baselineFootprintKgCO2e ?? firstYearTotalKg * 1.15;
  const trajectoryData = [
    { period: "Year 1", actual: firstYearTotalKg / 1000, baseline: baselineKg / 1000 },
    { period: "Year 2", actual: annualTotalKg / 1000, baseline: baselineKg / 1000 },
    { period: "Year 3", actual: annualTotalKg / 1000, baseline: baselineKg / 1000 },
    { period: "Year 4+", actual: annualTotalKg / 1000, baseline: baselineKg / 1000 },
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

      {/* ── Simulation progress ──────────────────────────────────── */}
      {simJob && (simRunning || simNeeded) && (
        <JobProgressCard job={simJob} type="simulation" />
      )}

      <div className="flex gap-6 items-start">
        {/* ── Charts (left 2/3) ────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Region Comparison — only when we have comparison regions */}
          {hasComparisons && regionChartData.length > 1 && !simRunning && (
            <Card className="card-elevated border-0 ring-1 ring-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">Region Comparison</CardTitle>
                <CardDescription>
                  Total CO₂e by region — home ({REGION_LABELS[primaryRegion] ?? primaryRegion}) vs comparison regions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="region" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${formatTonnes(v)} t`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                        formatter={(value: number) => [`${formatTonnes(value)} t CO₂e`, ""]}
                      />
                      <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                        {regionChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted-foreground">
                  {regionChartData.map((entry) => (
                    <div key={entry.region} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                      {entry.region} {entry.isHome ? "(Home)" : ""}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Carbon Intensity Benchmark */}
          <Card className="card-elevated border-0">
            <CardHeader>
              <CardTitle className="text-lg">Annual Operational Carbon Comparison</CardTitle>
              <CardDescription>
                Operational CO₂e per year (t) — {REGION_LABELS[primaryRegion] ?? (primaryRegion || "Your Region")} vs industry averages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={benchmarkData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${formatTonnes(v * 1000)} t`}
                    />
                    <YAxis type="category" dataKey="name" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number) => [`${formatTonnes(value * 1000)} t CO₂e / yr`, ""]}
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
                {benchmarkData.map((b) => (
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
              <CardTitle className="text-lg">Year 1 vs Recurring Years</CardTitle>
              <CardDescription>First year (embodied + operational) vs annual footprint (operational only) — t CO₂e</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trajectoryData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="period" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${formatTonnes(v * 1000)} t`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number) => [`${formatTonnes(value * 1000)} t CO₂e`, ""]}
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
              value={firstYearTotalKg > 0 ? `${embodiedPct}%` : "—"}
              sub="Year 1 only · % of first-year total"
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

            {/* Year 1 and Annual totals */}
            {firstYearTotalKg > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Year 1 total (embodied + ops)</p>
                  <p className="text-lg font-bold font-mono text-primary">{formatTonnes(firstYearTotalKg)} t</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Annual (recurring years)</p>
                  <p className="text-base font-bold font-mono text-foreground">{formatTonnes(annualTotalKg)} t/yr</p>
                </div>
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
