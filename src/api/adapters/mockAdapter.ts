import type { ImpactcheckClient } from "../impactcheckClient";
import type {
  Project,
  Document,
  JobStatus,
  ExtractedActivity,
  ActivityEstimate,
  Report,
  Recommendation,
} from "@/contracts/impactcheck.v2";
import { getActivityPhase } from "@/contracts/impactcheck.v2";

// ─── Deterministic hash ───────────────────────────────────────────────
function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ─── Stable Data ──────────────────────────────────────────────────────

const ACTIVITY_TEMPLATES: { text: string; unit_type: "Weight" | "Energy" | "Money"; quantity: number; unit: string; category: string }[] = [
  { text: "NVIDIA GB200 NVL72 rack manufacturing", unit_type: "Weight", quantity: 256, unit: "racks", category: "Hardware" },
  { text: "Liquid cooling unit production", unit_type: "Weight", quantity: 64, unit: "units", category: "Hardware" },
  { text: "Standard concrete pouring — foundation", unit_type: "Weight", quantity: 12000, unit: "MT", category: "Construction" },
  { text: "Steel rebar fabrication", unit_type: "Weight", quantity: 3200, unit: "MT", category: "Construction" },
  { text: "Diesel generators — backup power", unit_type: "Energy", quantity: 500, unit: "MWh", category: "Energy" },
  { text: "Grid electricity — operational year 1", unit_type: "Energy", quantity: 4380000, unit: "MWh", category: "Energy" },
  { text: "Transformer and switchgear manufacturing", unit_type: "Weight", quantity: 480, unit: "MT", category: "Hardware" },
  { text: "Fiber optic cabling installation", unit_type: "Weight", quantity: 120, unit: "km", category: "Infrastructure" },
  { text: "HVAC ductwork and piping", unit_type: "Weight", quantity: 950, unit: "MT", category: "Infrastructure" },
  { text: "Server room fire suppression system", unit_type: "Money", quantity: 1, unit: "system", category: "Infrastructure" },
  { text: "UPS battery bank manufacturing", unit_type: "Weight", quantity: 340, unit: "MT", category: "Hardware" },
  { text: "Employee commute — construction phase", unit_type: "Money", quantity: 180000, unit: "USD", category: "Transport" },
];

const REGIONS_GRID: Record<string, number> = {
  eu: 350,
  norway: 10,
  us: 380,
  iceland: 15,
};

function determineCo2e(text: string, region: string): number {
  const base = simpleHash(text + region);
  return 500 + (base % 600000);
}

// ─── Job tracking ─────────────────────────────────────────────────────
let jobPollCount: Record<string, number> = {};

function advanceJob(id: string, type: string): JobStatus {
  if (!jobPollCount[id]) jobPollCount[id] = 0;
  jobPollCount[id]++;
  const polls = jobPollCount[id];

  const stages = ["initializing", "processing", "finalizing"];
  const stageIdx = Math.min(Math.floor((polls - 1) / 2), 2);
  const progress = Math.min(polls * 20, 100);
  const status: JobStatus["status"] =
    progress >= 100 ? "succeeded" : polls === 0 ? "queued" : "running";

  return {
    id,
    type,
    status,
    progress,
    stage: stages[stageIdx],
    message: status === "succeeded" ? "Complete" : `Processing step ${polls}…`,
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  };
}

// ─── Mock Adapter ─────────────────────────────────────────────────────

export function createMockAdapter(): ImpactcheckClient {
  // Store multiple projects
  const projects: Project[] = [
    {
      id: "prj_1",
      name: "Abilene DC Expansion",
      year: 2026,
      companyType: "business",
      primaryRegion: "US",
      comparisonRegions: ["NO"],
      baselineFootprintKgCO2e: 1_200_000,
    },
    {
      id: "prj_2",
      name: "Oslo Green Campus",
      year: 2026,
      companyType: "investor",
      primaryRegion: "NO",
      comparisonRegions: [],
      baselineFootprintKgCO2e: 450_000,
    },
    {
      id: "prj_3",
      name: "EU Edge Cluster",
      year: 2025,
      companyType: "business",
      primaryRegion: "EU",
      comparisonRegions: ["IS"],
      baselineFootprintKgCO2e: 800_000,
    },
  ];

  const storedDocs: Document[] = [
    {
      id: "doc_1",
      projectId: "prj_1",
      filename: "hardware_bom_2026.xlsx",
      fileType: "xlsx",
      status: "ready",
      uploadedAt: "2026-01-10T08:30:00Z",
    },
    {
      id: "doc_2",
      projectId: "prj_1",
      filename: "energy_bills_q1.csv",
      fileType: "csv",
      status: "ready",
      uploadedAt: "2026-01-12T14:15:00Z",
    },
    {
      id: "doc_3",
      projectId: "prj_1",
      filename: "facility_specs.pdf",
      fileType: "pdf",
      status: "ready",
      uploadedAt: "2026-01-14T09:00:00Z",
    },
  ];

  let storedActivities: ExtractedActivity[] = ACTIVITY_TEMPLATES.map(
    (t, i) => ({
      id: `act_${i + 1}`,
      projectId: "prj_1",
      text: t.text,
      unit_type: t.unit_type,
      region: "us",
      quantity: t.quantity,
      unit: t.unit,
      sourceDocumentId: `doc_${(i % 3) + 1}`,
      category: t.category,
    })
  );

  function getProject(id: string): Project {
    return projects.find(p => p.id === id) ?? projects[0];
  }

  function buildEstimates(region: string): ActivityEstimate[] {
    return storedActivities.map((act, i) => ({
      activityId: act.id,
      region,
      matchedFactor: {
        id: `ef_${i + 1}`,
        name: ACTIVITY_TEMPLATES[i]?.category ?? "General",
        source: "EPA GHG Hub 2025",
        year: 2025,
        unit: act.unit,
      },
      confidence: 0.7 + ((simpleHash(act.text) % 30) / 100),
      co2eKg: determineCo2e(act.text, region),
      inputUsed: {
        unit_type: act.unit_type,
        quantity: act.quantity,
        amount: act.amount,
      },
    }));
  }

  function buildReport(projectId: string): Report {
    const proj = getProject(projectId);
    const regions = [proj.primaryRegion, ...(proj.comparisonRegions ?? [])];
    const totals: Record<string, number> = {};
    const breakdowns: Record<string, { category: string; co2eKg: number }[]> = {};

    for (const region of regions) {
      const estimates = buildEstimates(region);
      totals[region] = estimates.reduce((s, e) => s + e.co2eKg, 0);

      const byCat: Record<string, number> = {};
      estimates.forEach((e, i) => {
        const cat = ACTIVITY_TEMPLATES[i]?.category ?? "Other";
        byCat[cat] = (byCat[cat] ?? 0) + e.co2eKg;
      });
      breakdowns[region] = Object.entries(byCat).map(([category, co2eKg]) => ({
        category,
        co2eKg,
      }));
    }

    const primaryTotal = totals[proj.primaryRegion] ?? 0;
    const deltaVsBaselineKg = proj.baselineFootprintKgCO2e
      ? primaryTotal - proj.baselineFootprintKgCO2e
      : undefined;

    const allEstimates = buildEstimates(proj.primaryRegion);
    const sorted = [...allEstimates].sort((a, b) => b.co2eKg - a.co2eKg);
    const hotspots = sorted.slice(0, 5).map((e) => {
      const act = storedActivities.find((a) => a.id === e.activityId);
      return { text: act?.text ?? e.activityId, co2eKg: e.co2eKg, phase: getActivityPhase(act?.category) as "embodied" | "operational" };
    });

    const phaseTotalsByRegion: Record<string, { embodied: number; operational: number }> = {};
    for (const region of regions) {
      const regionEstimates = buildEstimates(region);
      let embodied = 0;
      let operational = 0;
      for (const e of regionEstimates) {
        const act = storedActivities.find((a) => a.id === e.activityId);
        const phase = getActivityPhase(act?.category);
        if (phase === "embodied") embodied += e.co2eKg;
        else operational += e.co2eKg;
      }
      phaseTotalsByRegion[region] = { embodied, operational };
    }

    return {
      projectId,
      totalsByRegion: totals,
      categoryBreakdownByRegion: breakdowns,
      phaseTotalsByRegion,
      deltaVsBaselineKg,
      compliance: {
        us: {
          status: primaryTotal > 2_000_000 ? "red" : primaryTotal > 800_000 ? "yellow" : "green",
          reasons:
            primaryTotal > 2_000_000
              ? ["Exceeds EPA Scope 2 threshold for large facilities"]
              : primaryTotal > 800_000
                ? ["Within reporting threshold; voluntary reduction recommended"]
                : ["Below mandatory reporting threshold"],
        },
        eu: {
          status: primaryTotal > 1_500_000 ? "red" : primaryTotal > 600_000 ? "yellow" : "green",
          reasons:
            primaryTotal > 1_500_000
              ? ["Exceeds CSRD materiality threshold"]
              : primaryTotal > 600_000
                ? ["Subject to EU Taxonomy disclosure requirements"]
                : ["Below CSRD mandatory threshold"],
        },
        byRegion: {},
      },
      hotspots,
    };
  }

  return {
    // Project
    async createProject(params) {
      const newProject: Project = {
        id: `prj_${projects.length + 1}`,
        name: params.name,
        year: params.year,
        companyType: params.companyType,
        primaryRegion: params.primaryRegion,
        comparisonRegions: params.comparisonRegions,
      };
      projects.push(newProject);
      return { ...newProject };
    },
    async getProject(projectId) {
      return { ...getProject(projectId) };
    },
    async listProjects() {
      return [...projects];
    },
    async deleteProject(projectId) {
      const idx = projects.findIndex(p => p.id === projectId);
      if (idx !== -1) projects.splice(idx, 1);
    },

    // Documents
    async uploadDocument(projectId, file) {
      const doc: Document = {
        id: `doc_${storedDocs.length + 1}`,
        projectId,
        filename: file.name,
        fileType: file.name.split(".").pop() ?? "unknown",
        status: "ready",
        uploadedAt: "2026-02-01T12:00:00Z",
      };
      storedDocs.push(doc);
      return doc;
    },
    async listDocuments() {
      return [...storedDocs];
    },
    async deleteDocument(_projectId, documentId) {
      const idx = storedDocs.findIndex(d => d.id === documentId);
      if (idx !== -1) storedDocs.splice(idx, 1);
    },

    // Extract
    async startExtract() {
      jobPollCount["job_extract_1"] = 0;
      return advanceJob("job_extract_1", "extract");
    },
    async getJob(jobId) {
      return advanceJob(jobId, "extract");
    },
    async getActiveJob() {
      return null;
    },

    // Activities
    async getActivities() {
      return [...storedActivities];
    },
    async updateActivities(_pid, activities) {
      storedActivities = activities;
      return [...storedActivities];
    },
    async exportCsv() {
      const header = "id,text,unit_type,region,quantity,unit";
      const rows = storedActivities.map(
        (a) =>
          `${a.id},"${a.text}",${a.unit_type ?? ""},${a.region ?? ""},${a.quantity ?? ""},${a.unit ?? ""}`
      );
      return [header, ...rows].join("\n");
    },

    // Mapping
    async startMapping() {
      jobPollCount["job_map_1"] = 0;
      return advanceJob("job_map_1", "mapping");
    },
    async getEstimates() {
      return buildEstimates(getProject("prj_1").primaryRegion);
    },

    // Simulation
    async startSimulation() {
      jobPollCount["job_sim_1"] = 0;
      return advanceJob("job_sim_1", "simulation");
    },
    async getSimulationEstimates() {
      return [];
    },

    // Report
    async getReport(projectId) {
      return buildReport(projectId);
    },

    async getCompliance() {
      return { byRegion: {} };
    },

    // Recommendations
    async startRecommendations() {
      return { id: "job_rec_1", type: "recommendations", status: "succeeded" as const, progress: 100, stage: "done", message: "Done", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    },
    async getRecommendations() {
      return [
        {
          id: "rec_1",
          projectId: "prj_1",
          title: "Switch to low-carbon concrete",
          summary: "Replace standard concrete with low-carbon mix to reduce embodied emissions by ~50% on concrete line items.",
          expectedDeltaKg: -2_700_000,
          constraints: ["Supplier availability in Texas region"],
          strategyDraftText: "Transition 100% of concrete procurement to verified low-carbon suppliers. Expected reduction: 2,700 t CO₂e.",
        },
        {
          id: "rec_2",
          projectId: "prj_1",
          title: "Procure renewable energy PPAs",
          summary: "Offset grid emissions with Power Purchase Agreements for wind/solar in the ERCOT region.",
          expectedDeltaKg: -1_500_000,
          constraints: ["Long-term PPA contract negotiation required"],
          strategyDraftText: "Execute 10-year PPA with regional wind farm. Projected annual offset: 1,500 t CO₂e.",
        },
        {
          id: "rec_3",
          projectId: "prj_1",
          title: "Optimize PUE to 1.10",
          summary: "Invest in advanced liquid cooling and hot aisle containment to reduce PUE from 1.20 to 1.10.",
          expectedDeltaKg: -800_000,
          strategyDraftText: "Deploy rear-door heat exchangers and upgrade CRAH units. Target PUE 1.10 within 18 months.",
        },
      ];
    },
    async generateRecommendations() {
      return this.getRecommendations();
    },
    async finalizeStrategy(_pid, recIds) {
      return {
        strategyText: `Finalized strategy incorporating ${recIds.length} recommendations. Total projected reduction: ${recIds.length * 1_500} t CO₂e.`,
      };
    },

  };
}
