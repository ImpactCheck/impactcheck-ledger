import { supabase } from "@/integrations/supabase/client";
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

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function invokeFunction(name: string, body: Record<string, unknown>) {
  const resp = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`${name} failed: ${err}`);
  }
  return resp.json();
}

export function createSupabaseAdapter(): ImpactcheckClient {
  return {
    // ─── Projects ──────────────────────────────────────────
    async createProject(params) {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: params.name,
          year: params.year,
          company_type: params.companyType,
          primary_region: params.primaryRegion,
          comparison_regions: params.comparisonRegions || [],
        })
        .select()
        .single();
      if (error) throw error;
      return mapProject(data);
    },

    async getProject(projectId) {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Project not found");
      return mapProject(data);
    },

    async listProjects() {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapProject);
    },

    async deleteProject(projectId) {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);
      if (error) throw error;
    },

    // ─── Documents ─────────────────────────────────────────
    async uploadDocument(projectId, file) {
      const storagePath = `${projectId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, file);
      if (uploadErr) throw uploadErr;

      const { data, error } = await supabase
        .from("documents")
        .insert({
          project_id: projectId,
          filename: file.name,
          file_type: file.name.split(".").pop() || "unknown",
          storage_path: storagePath,
          status: "ready",
        })
        .select()
        .single();
      if (error) throw error;
      return mapDocument(data);
    },

    async listDocuments(projectId) {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapDocument);
    },

    async deleteDocument(projectId, documentId) {
      const { data: doc } = await supabase
        .from("documents")
        .select("storage_path")
        .eq("id", documentId)
        .maybeSingle();

      if (doc?.storage_path) {
        await supabase.storage.from("documents").remove([doc.storage_path]);
      }

      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId);
      if (error) throw error;
    },

    // ─── Extract ───────────────────────────────────────────
    async startExtract(projectId) {
      return invokeFunction("extract", { projectId });
    },

    async getJob(jobId) {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Job not found");
      return mapJob(data);
    },

    async getActiveJob(projectId, type) {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", type)
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? mapJob(data) : null;
    },

    // ─── Activities ────────────────────────────────────────
    async getActivities(projectId) {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map(mapActivity);
    },

    async updateActivities(projectId, activities) {
      for (const act of activities) {
        await supabase
          .from("activities")
          .update({
            text: act.text,
            unit_type: act.unit_type,
            region: act.region,
            quantity: act.quantity,
            unit: act.unit,
            amount: act.amount,
            currency: act.currency,
            note: act.note,
          })
          .eq("id", act.id);
      }
      return this.getActivities(projectId);
    },

    async exportCsv(projectId) {
      const activities = await this.getActivities(projectId);
      const header = "id,text,unit_type,region,quantity,unit";
      const rows = activities.map(
        (a) => `${a.id},"${a.text}",${a.unit_type ?? ""},${a.region ?? ""},${a.quantity ?? ""},${a.unit ?? ""}`
      );
      return [header, ...rows].join("\n");
    },

    // ─── Mapping ───────────────────────────────────────────
    async startMapping(projectId) {
      return invokeFunction("mapping", { projectId });
    },

    async getEstimates(projectId) {
      const { data, error } = await supabase
        .from("estimates")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data || []).map(mapEstimate);
    },

    // ─── Report ────────────────────────────────────────────
    async getReport(projectId) {
      const project = await this.getProject(projectId);
      const estimates = await this.getEstimates(projectId);
      const activities = await this.getActivities(projectId);

      const regions = [project.primaryRegion, ...(project.comparisonRegions || [])];
      const totals: Record<string, number> = {};
      const breakdowns: Record<string, { category: string; co2eKg: number }[]> = {};

      for (const region of regions) {
        const regionEstimates = estimates.filter((e) => e.region === region || (!e.region && region === project.primaryRegion));
        totals[region] = regionEstimates.reduce((s, e) => s + e.co2eKg, 0);

        const byCat: Record<string, number> = {};
        regionEstimates.forEach((e) => {
          const cat = e.matchedFactor.name || "Other";
          byCat[cat] = (byCat[cat] ?? 0) + e.co2eKg;
        });
        breakdowns[region] = Object.entries(byCat).map(([category, co2eKg]) => ({ category, co2eKg }));
      }

      const primaryTotal = totals[project.primaryRegion] ?? 0;
      const deltaVsBaselineKg = project.baselineFootprintKgCO2e
        ? primaryTotal - project.baselineFootprintKgCO2e
        : undefined;

      const sorted = [...estimates].sort((a, b) => b.co2eKg - a.co2eKg);
      const hotspots = sorted.slice(0, 5).map((e) => {
        const act = activities.find((a) => a.id === e.activityId);
        return { text: act?.text ?? e.activityId, co2eKg: e.co2eKg, phase: getActivityPhase(act?.category) };
      });

      return {
        projectId,
        totalsByRegion: totals,
        categoryBreakdownByRegion: breakdowns,
        deltaVsBaselineKg,
        compliance: {
          us: {
            status: primaryTotal > 2_000_000 ? "red" as const : primaryTotal > 800_000 ? "yellow" as const : "green" as const,
            reasons: primaryTotal > 2_000_000
              ? ["Exceeds EPA Scope 2 threshold for large facilities"]
              : primaryTotal > 800_000
                ? ["Within reporting threshold; voluntary reduction recommended"]
                : ["Below mandatory reporting threshold"],
          },
          eu: {
            status: primaryTotal > 1_500_000 ? "red" as const : primaryTotal > 600_000 ? "yellow" as const : "green" as const,
            reasons: primaryTotal > 1_500_000
              ? ["Exceeds CSRD materiality threshold"]
              : primaryTotal > 600_000
                ? ["Subject to EU Taxonomy disclosure requirements"]
                : ["Below CSRD mandatory threshold"],
          },
        },
        hotspots,
      };
    },

    // ─── Recommendations ───────────────────────────────────
    async generateRecommendations(projectId) {
      return invokeFunction("recommendations", { projectId });
    },

    async finalizeStrategy(projectId, recommendationIds) {
      return invokeFunction("recommendations", {
        projectId,
        action: "finalize",
        recommendationIds,
      });
    },

  };
}

// ─── Mappers ─────────────────────────────────────────────

function mapProject(d: any): Project {
  return {
    id: d.id,
    name: d.name,
    year: d.year,
    companyType: d.company_type,
    primaryRegion: d.primary_region,
    comparisonRegions: d.comparison_regions || [],
    baselineFootprintKgCO2e: d.baseline_footprint_kg_co2e ? Number(d.baseline_footprint_kg_co2e) : undefined,
  };
}

function mapDocument(d: any): Document {
  return {
    id: d.id,
    projectId: d.project_id,
    filename: d.filename,
    fileType: d.file_type,
    status: d.status,
    uploadedAt: d.uploaded_at,
    storagePath: d.storage_path ?? undefined,
  };
}

function mapJob(d: any): JobStatus {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    progress: d.progress,
    stage: d.stage,
    message: d.message,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapActivity(d: any): ExtractedActivity {
  return {
    id: d.id,
    projectId: d.project_id,
    text: d.text,
    unit_type: d.unit_type,
    region: d.region,
    quantity: d.quantity ? Number(d.quantity) : undefined,
    unit: d.unit,
    amount: d.amount ? Number(d.amount) : undefined,
    currency: d.currency,
    sourceDocumentId: d.source_document_id,
    note: d.note,
    category: d.category ?? undefined,
    phase: d.phase ?? undefined,
    phaseReason: d.phase_reason ?? undefined,
  };
}

function mapEstimate(d: any): ActivityEstimate {
  return {
    activityId: d.activity_id,
    region: d.region,
    matchedFactor: d.matched_factor || { id: "", name: "", source: "" },
    confidence: Number(d.confidence),
    co2eKg: Number(d.co2e_kg),
    inputUsed: d.input_used || {},
  };
}
