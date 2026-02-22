// ─── ImpactCheck v2 Contract Types ────────────────────────────────────

export type RegionCode = string;

export type CompanyType = "ai_infra" | "other";

export type UnitType = "Weight" | "Energy" | "Power" | "Volume" | "Area" | "Distance" | "Money" | "Number" | "Data" | "Time" | "WeightOverDistance" | "ContainerOverDistance" | "PassengerOverDistance" | "AreaOverTime" | "DataOverTime" | "DistanceOverTime" | "NumberOverTime" | "WeightOverTime";

// ─── Core Entities ────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  year: number;
  companyType: CompanyType;
  primaryRegion: RegionCode;
  comparisonRegions?: RegionCode[];
  baselineFootprintKgCO2e?: number;
}

export interface Document {
  id: string;
  projectId: string;
  filename: string;
  fileType: string;
  status: "pending" | "processing" | "ready" | "error";
  uploadedAt: string;
  jobId?: string;
  storagePath?: string;
}

export interface JobStatus {
  id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  stage?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedActivity {
  id: string;
  projectId: string;
  text: string;
  search_query?: string;
  unit_type?: UnitType;
  region?: RegionCode;
  quantity?: number;
  unit?: string;
  amount?: number;
  currency?: string;
  sourceDocumentId?: string;
  note?: string;
  category?: string;
  phase?: "embodied" | "operational";
  phaseReason?: string;
}

// ─── Activity Phase Classification ───────────────────────────────────

export type ActivityPhase = "embodied" | "operational";

const EMBODIED_CATEGORIES = [
  "HARDWARE", "CONSTRUCTION", "PROCUREMENT", "MANUFACTURING",
  "INFRASTRUCTURE", "EQUIPMENT", "INSTALLATION", "CAPEX", "MATERIAL",
  "NETWORK_HARDWARE", "COOLING_EQUIPMENT", "ELECTRICAL", "CIVIL",
];

const OPERATIONAL_CATEGORIES = [
  "ENERGY", "ELECTRICITY", "POWER", "FUEL", "COOLING", "WATER",
  "TRANSPORT", "CLOUD", "DATA_TRANSFER", "MAINTENANCE", "OPERATIONS",
  "STAFFING", "OPEX",
];

export function getActivityPhase(category: string | undefined): ActivityPhase {
  if (!category) return "operational";
  const upper = category.toUpperCase();
  if (EMBODIED_CATEGORIES.some((c) => upper.includes(c))) return "embodied";
  if (OPERATIONAL_CATEGORIES.some((c) => upper.includes(c))) return "operational";
  return "operational";
}

export interface ActivityEstimate {
  activityId: string;
  region?: RegionCode;
  matchedFactor: {
    id: string;
    name: string;
    source: string;
    year?: number;
    unit?: string;
  };
  confidence: number;
  co2eKg: number;
  inputUsed: {
    unit_type?: UnitType;
    quantity?: number;
    amount?: number;
    currency?: string;
    note?: string;
  };
  rank_position?: number;
  selected?: boolean;
  mapping_confidence?: "high" | "medium" | "low";
}

export interface PhaseTotals {
  embodied: number;
  operational: number;
}

/** Per-jurisdiction compliance from the compliance engine (Norway, EU, USA, Iceland) */
export interface JurisdictionCompliance {
  evaluation_status: "EVALUATED" | "NOT_EVALUATED";
  inputs?: Record<string, { status: string; value?: unknown; unit?: string; source?: string }>;
  checks?: Record<string, { status: "PASS" | "FAIL" | "MISSING"; computed_from?: string[] }>;
}

/** Per-region compliance result from Gemini compliance engine */
export interface RegionComplianceResult {
  primary_jurisdiction: "Norway" | "EU" | "USA" | "Iceland";
  jurisdictions?: Record<string, JurisdictionCompliance>;
  totalCo2eKg?: number;
  totalCo2eTonnes?: number;
  error?: string;
}

export interface Report {
  projectId: string;
  totalsByRegion: Record<string, number>;
  categoryBreakdownByRegion?: Record<
    string,
    { category: string; co2eKg: number }[]
  >;
  phaseTotalsByRegion?: Record<string, PhaseTotals>;
  deltaVsBaselineKg?: number;
  compliance: {
    us: { status: "green" | "yellow" | "red"; reasons: string[] };
    eu: { status: "green" | "yellow" | "red"; reasons: string[] };
    /** Per-region compliance from compliance engine (home + comparison regions) */
    byRegion?: Record<string, RegionComplianceResult>;
  };
  hotspots: { text: string; co2eKg: number; phase?: ActivityPhase }[];
}

export interface Recommendation {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  expectedDeltaKg: number;
  constraints?: string[];
  strategyDraftText: string;
}

// ─── Utility Helpers ──────────────────────────────────────────────────

export function formatTonnes(kg: number): string {
  if (kg >= 1e6) return `${(kg / 1e6).toFixed(1)}M`;
  if (kg >= 1e3) return `${(kg / 1e3).toFixed(1)}K`;
  return kg.toFixed(0);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
