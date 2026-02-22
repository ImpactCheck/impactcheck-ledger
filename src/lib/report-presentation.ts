import type { UseCase } from "@/contexts/ProjectContext";

// ─── Report Section IDs ──────────────────────────────────────────────
export type ReportSectionId =
  | "executive-summary"
  | "hotspots"
  | "scenarios"
  | "compliance"
  | "missing-data"
  | "region-comparison"
  | "category-breakdown"
  | "data-quality"
  | "traceability"
  | "assumptions";

export interface SectionLayout {
  id: ReportSectionId;
  hero?: boolean;
  collapsed?: boolean;
}

export interface PresentationLayout {
  sections: SectionLayout[];
  limits: {
    hotspots: number;
    scenarios: number;
    traceabilityFull?: boolean;
  };
}

// ─── Layout Definitions ──────────────────────────────────────────────

const COMPANY_LAYOUT: PresentationLayout = {
  sections: [
    { id: "executive-summary" },
    { id: "hotspots", hero: true },
    { id: "scenarios", hero: true },
    { id: "compliance" },
    { id: "missing-data" },
    { id: "region-comparison" },
    { id: "category-breakdown" },
    { id: "data-quality", collapsed: true },
    { id: "traceability", collapsed: true },
    { id: "assumptions", collapsed: true },
  ],
  limits: { hotspots: 10, scenarios: 5 },
};

const INVESTOR_LAYOUT: PresentationLayout = {
  sections: [
    { id: "executive-summary", hero: true },
    { id: "compliance", hero: true },
    { id: "data-quality", hero: true },
    { id: "missing-data" },
    { id: "hotspots" },
    { id: "region-comparison" },
    { id: "scenarios" },
    { id: "category-breakdown", collapsed: true },
    { id: "traceability", collapsed: true },
    { id: "assumptions", collapsed: true },
  ],
  limits: { hotspots: 5, scenarios: 3 },
};

const REGULATOR_LAYOUT: PresentationLayout = {
  sections: [
    { id: "compliance", hero: true },
    { id: "missing-data", hero: true },
    { id: "traceability", hero: true },
    { id: "executive-summary" },
    { id: "region-comparison" },
    { id: "hotspots" },
    { id: "category-breakdown" },
    { id: "data-quality" },
    { id: "scenarios", collapsed: true },
    { id: "assumptions" },
  ],
  limits: { hotspots: 10, scenarios: 5, traceabilityFull: true },
};

const OTHER_LAYOUT: PresentationLayout = {
  sections: [
    { id: "executive-summary", hero: true },
    { id: "region-comparison", hero: true },
    { id: "hotspots" },
    { id: "data-quality" },
    { id: "compliance", collapsed: true },
    { id: "missing-data", collapsed: true },
    { id: "scenarios", collapsed: true },
    { id: "traceability", collapsed: true },
    { id: "assumptions", collapsed: true },
  ],
  limits: { hotspots: 3, scenarios: 3 },
};

const LAYOUTS: Record<UseCase, PresentationLayout> = {
  company: COMPANY_LAYOUT,
  investor: INVESTOR_LAYOUT,
  regulator: REGULATOR_LAYOUT,
  other: OTHER_LAYOUT,
};

// ─── Resolver ────────────────────────────────────────────────────────

export function getReportLayout(
  useCase: UseCase,
  hasMultipleRegions: boolean
): PresentationLayout {
  const base = LAYOUTS[useCase];

  if (!hasMultipleRegions) {
    // Remove region-comparison; if it was hero, promote category-breakdown to hero
    const regionSection = base.sections.find((s) => s.id === "region-comparison");
    const wasHero = regionSection?.hero ?? false;

    const filtered = base.sections.filter((s) => s.id !== "region-comparison");

    if (wasHero) {
      return {
        ...base,
        sections: filtered.map((s) =>
          s.id === "category-breakdown" ? { ...s, hero: true } : s
        ),
      };
    }

    return { ...base, sections: filtered };
  }

  return base;
}

// ─── Section Labels ──────────────────────────────────────────────────

export const SECTION_LABELS: Record<ReportSectionId, string> = {
  "executive-summary": "Executive Summary",
  hotspots: "Top Hotspots",
  scenarios: "Reduction Scenarios",
  compliance: "Regulatory Compliance",
  "missing-data": "Missing Data & Evidence Gaps",
  "region-comparison": "Per-Region Comparison",
  "category-breakdown": "Category Breakdown",
  "data-quality": "Data Quality & Confidence",
  traceability: "Traceability & Factor Metadata",
  assumptions: "Assumptions & Boundaries",
};

export const USE_CASE_LABELS: Record<UseCase, string> = {
  company: "Company",
  investor: "Investor",
  regulator: "Regulator",
  other: "Other",
};
