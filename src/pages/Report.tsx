import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, AlertTriangle, Printer, Loader2, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { Report as ReportType, Recommendation } from "@/contracts/impactcheck.v2";
import { AuditCertificate } from "@/components/AuditCertificate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getReportLayout,
  SECTION_LABELS,
  USE_CASE_LABELS,
  type ReportSectionId,
  type SectionLayout,
} from "@/lib/report-presentation";

// Section components
import { ExecutiveSummarySection } from "@/components/report/ExecutiveSummarySection";
import { PhaseSplitSection } from "@/components/report/PhaseSplitSection";
import { RegionMapSection } from "@/components/report/RegionMapSection";
import { HotspotsSection } from "@/components/report/HotspotsSection";
import { ComplianceSection } from "@/components/report/ComplianceSection";
import { CategoryBreakdownSection } from "@/components/report/CategoryBreakdownSection";
import { RegionComparisonSection } from "@/components/report/RegionComparisonSection";
import { ScenariosSection } from "@/components/report/ScenariosSection";
import { MissingDataSection } from "@/components/report/MissingDataSection";
import { DataQualitySection } from "@/components/report/DataQualitySection";
import { TraceabilitySection } from "@/components/report/TraceabilitySection";
import { AssumptionsSection } from "@/components/report/AssumptionsSection";

export default function Report() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId;
  const [report, setReport] = useState<ReportType | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});

  const loadReport = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    api
      .getReport(projectId)
      .then((r) => {
        setReport(r);
        setLoading(false);
        // Load compliance in background (slow Gemini calls)
        api.getCompliance(projectId)
          .then((c) => {
            setReport(prev => prev ? { ...prev, compliance: { ...prev.compliance, byRegion: c.byRegion } } : prev);
          })
          .catch(() => {});
        // Load recommendations in background
        api.generateRecommendations(projectId).then(setRecommendations).catch(() => setRecommendations([]));
      })
      .catch((e) => {
        setError(e.message ?? "Failed to load report");
        setLoading(false);
      });
  }, [projectId]);

  // On mount: load report directly (simulations are triggered from Benchmarking step)
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      setError("No project selected. Please set up a project first.");
      return;
    }
    loadReport();
  }, [projectId, loadReport]);

  const useCase = project.useCase;
  const hasMultipleRegions = report ? Object.keys(report.totalsByRegion).length > 1 : false;
  const layout = useMemo(() => getReportLayout(useCase, hasMultipleRegions), [useCase, hasMultipleRegions]);

  const primaryRegion = report ? Object.keys(report.totalsByRegion)[0] ?? "" : "";
  const categories = report?.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  const phaseTotals = report?.phaseTotalsByRegion?.[primaryRegion] ?? { embodied: 0, operational: 0 };
  const regionCompareData = report
    ? Object.entries(report.totalsByRegion).map(([region, total]) => ({ region: region.replace(/_/g, " "), total }))
    : [];

  const isSectionCollapsed = useCallback(
    (section: SectionLayout) => {
      if (showAll) return false;
      if (collapsedOverrides[section.id] !== undefined) return collapsedOverrides[section.id];
      return section.collapsed ?? false;
    },
    [showAll, collapsedOverrides]
  );

  const toggleSection = (id: ReportSectionId) => {
    setCollapsedOverrides((prev) => ({ ...prev, [id]: !isSectionCollapsed({ id, collapsed: layout.sections.find(s => s.id === id)?.collapsed }) }));
  };

  const renderSection = (section: SectionLayout) => {
    if (!report) return null;
    const isHero = section.hero ?? false;
    const collapsed = isSectionCollapsed(section);

    const content = (() => {
      switch (section.id) {
        case "executive-summary":
          return <ExecutiveSummarySection report={report} primaryRegion={primaryRegion} hero={isHero} />;
        case "phase-split":
          return <PhaseSplitSection phaseTotals={phaseTotals} hero={isHero} />;
        case "region-map":
          return <RegionMapSection totalsByRegion={report.totalsByRegion} hero={isHero} />;
        case "hotspots":
          return <HotspotsSection report={report} limit={layout.limits.hotspots} hero={isHero} />;
        case "scenarios":
          return <ScenariosSection recommendations={recommendations} limit={layout.limits.scenarios} hero={isHero} />;
        case "compliance":
          return <ComplianceSection report={report} hero={isHero} />;
        case "missing-data":
          return <MissingDataSection report={report} hero={isHero} />;
        case "region-comparison":
          return <RegionComparisonSection regionData={regionCompareData} hero={isHero} />;
        case "category-breakdown":
          return <CategoryBreakdownSection categories={categories} primaryRegion={primaryRegion} hero={isHero} />;
        case "data-quality":
          return <DataQualitySection report={report} hero={isHero} />;
        case "traceability":
          return <TraceabilitySection report={report} hero={isHero} />;
        case "assumptions":
          return <AssumptionsSection hero={isHero} />;
        default:
          return null;
      }
    })();

    if (!content) return null;

    if (section.collapsed !== undefined || collapsedOverrides[section.id] !== undefined) {
      return (
        <div key={section.id}>
          <button
            onClick={() => toggleSection(section.id)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2 w-full text-left"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {SECTION_LABELS[section.id]}
          </button>
          {!collapsed && content}
        </div>
      );
    }

    return <div key={section.id}>{content}</div>;
  };


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
            Complete the Setup, Upload, Emissions, and Mapping steps before viewing the report.
          </p>
          <Button variant="outline" onClick={() => navigate("/setup")} className="mt-4 gap-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Go to Setup
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 print:space-y-4 print:max-w-none print:p-0 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="step-number">Step 05</p>
            <Badge variant="outline" className="text-[10px] rounded-full font-mono">
              {USE_CASE_LABELS[useCase]} view
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Carbon Audit Final Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Full lifecycle carbon assessment per GHG Protocol.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            className="gap-1.5 rounded-xl"
          >
            {showAll ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showAll ? "Use case layout" : "Show all sections"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 rounded-xl">
            <Printer className="h-3.5 w-3.5" /> Print / Export
          </Button>
          <AuditCertificate report={report} projectName={project.projectName} primaryRegion={primaryRegion} />
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">ImpactCheck — Carbon Audit Final Report</h1>
        <p className="text-sm">{project.projectName} · {project.year} · {primaryRegion.replace(/_/g, " ")} · {USE_CASE_LABELS[useCase]} view</p>
      </div>

      {/* Dynamic sections */}
      {layout.sections.map(renderSection)}

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
