import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/api";
import type { Report as ReportType } from "@/contracts/impactcheck.v2";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import { AuditCertificate } from "@/components/AuditCertificate";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useProject } from "@/contexts/ProjectContext";

/* Green scale for charts (matches CSS --green-*) */
const CATEGORY_COLORS = [
  "hsl(145 55% 42%)",
  "hsl(145 45% 55%)",
  "hsl(145 55% 32%)",
  "hsl(145 38% 70%)",
  "hsl(145 55% 28%)",
  "hsl(145 40% 85%)",
];

const CHART_GRID_LIGHT = "hsl(220 15% 92%)";
const CHART_GRID_DARK = "hsl(220 15% 20%)";
const CHART_TICK_LIGHT = "hsl(220 10% 45%)";
const CHART_TICK_DARK = "hsl(215 15% 55%)";
const TOOLTIP_BG_LIGHT = "hsl(0 0% 100%)";
const TOOLTIP_BG_DARK = "hsl(220 18% 13%)";
const TOOLTIP_BORDER_LIGHT = "hsl(220 15% 92%)";
const TOOLTIP_BORDER_DARK = "hsl(220 15% 20%)";

function useIsDark() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    const handleChange = () => {
      setIsDark(root.classList.contains("dark"));
    };

    // Ensure state is in sync on mount
    handleChange();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          handleChange();
          break;
        }
      }
    });

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
    };
  }, []);

  return isDark;
}

export default function Report() {
  const navigate = useNavigate();
  const { project } = useProject();
  const [report, setReport] = useState<ReportType | null>(null);
  const isDark = useIsDark();

  useEffect(() => {
    api.getReport("prj_1").then(setReport);
  }, []);

  if (!report) return null;

  const primaryRegion = Object.keys(report.totalsByRegion)[0] ?? "";
  const primaryTotal = report.totalsByRegion[primaryRegion] ?? 0;
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  const regionCompareData = Object.entries(report.totalsByRegion).map(([region, total]) => ({
    region,
    total,
  }));

  const gridStroke = isDark ? CHART_GRID_DARK : CHART_GRID_LIGHT;
  const tickFill = isDark ? CHART_TICK_DARK : CHART_TICK_LIGHT;
  const tooltipBg = isDark ? TOOLTIP_BG_DARK : TOOLTIP_BG_LIGHT;
  const tooltipBorder = isDark ? TOOLTIP_BORDER_DARK : TOOLTIP_BORDER_LIGHT;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carbon Report</h1>
          <p className="text-muted-foreground mt-1">Full lifecycle carbon assessment.</p>
        </div>
        <AuditCertificate
          report={report}
          projectName={project.projectName}
          primaryRegion={primaryRegion}
        />
      </div>

      {/* Hero total - dark green gradient card */}
      <Card variant="highlight">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-primary-foreground/80 uppercase tracking-wider">
                Total Lifecycle Carbon — {primaryRegion}
              </p>
              <p className="text-4xl font-bold font-mono text-primary-foreground mt-1">
                {formatTonnes(primaryTotal)}{" "}
                <span className="text-lg text-primary-foreground/85 font-normal">tonnes CO₂e</span>
              </p>
              {report.deltaVsBaselineKg !== undefined && (
                <p className="text-sm text-primary-foreground/80 mt-1 flex items-center gap-1">
                  {report.deltaVsBaselineKg > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {report.deltaVsBaselineKg > 0 ? "+" : ""}
                  {formatTonnes(report.deltaVsBaselineKg)} t vs. baseline
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <ComplianceBadge level={report.compliance.us.status} onDark />
              <ComplianceBadge level={report.compliance.eu.status} onDark />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary metric cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Footprint</p>
            <p className="text-2xl font-bold font-mono text-foreground mt-1">
              {formatTonnes(primaryTotal)} <span className="text-sm font-normal text-muted-foreground">t</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Delta vs Baseline</p>
            <p className="text-2xl font-bold font-mono mt-1">
              {report.deltaVsBaselineKg !== undefined ? (
                <span className={report.deltaVsBaselineKg >= 0 ? "text-destructive" : "text-primary"}>
                  {report.deltaVsBaselineKg >= 0 ? "+" : ""}
                  {formatTonnes(report.deltaVsBaselineKg)} t
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-col justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">US Compliance</p>
            <div className="mt-2">
              <ComplianceBadge level={report.compliance.us.status} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-col justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">EU Compliance</p>
            <div className="mt-2">
              <ComplianceBadge level={report.compliance.eu.status} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Category Breakdown</CardTitle>
            <CardDescription>Emissions by category for {primaryRegion}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="category"
                    tick={{ fill: tickFill, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: tickFill, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatTonnes(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${formatTonnes(value)} t CO₂e`, ""]}
                  />
                  <Bar dataKey="co2eKg" radius={[6, 6, 0, 0]}>
                    {categories.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {regionCompareData.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Region Comparison</CardTitle>
              <CardDescription>Total CO₂e by region</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionCompareData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis
                      dataKey="region"
                      tick={{ fill: tickFill, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: tickFill, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatTonnes(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: tooltipBg,
                        border: `1px solid ${tooltipBorder}`,
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [`${formatTonnes(value)} t CO₂e`, ""]}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="hsl(145 55% 38%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Top Hotspots
          </CardTitle>
          <CardDescription>Highest-emission activities requiring attention.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {report.hotspots.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
              >
                <span>{h.text}</span>
                <span className="font-mono font-bold text-primary">{formatTonnes(h.co2eKg)} t</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/mapping")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => navigate("/recommendations")} className="gap-2">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
