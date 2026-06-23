import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/ProjectContext";

export interface StepCompletion {
  setup: boolean;
  upload: boolean;
  activities: boolean;
  mapping: boolean;
  benchmarking: boolean;
  report: boolean;
  recommendations: boolean;
}

const EMPTY: StepCompletion = {
  setup: false,
  upload: false,
  activities: false,
  mapping: false,
  benchmarking: false,
  report: false,
  recommendations: false,
};

/** Workflow steps used in the sidebar (matches DashboardLayout STEPS) */
export const WORKFLOW_STEP_KEYS: (keyof StepCompletion)[] = [
  "setup",
  "upload",
  "mapping",
  "benchmarking",
  "report",
  "recommendations",
];

/**
 * Compute progress percentage from step completion (0–100).
 */
export function getProgressFromCompletion(c: StepCompletion): number {
  const completed = WORKFLOW_STEP_KEYS.filter((k) => c[k]).length;
  return Math.round((completed / WORKFLOW_STEP_KEYS.length) * 100);
}

/**
 * Checks actual DB data to determine which workflow steps are complete.
 */
export function useStepCompletion(): StepCompletion {
  const { project } = useProject();
  const projectId = project.currentProjectId;
  const [completion, setCompletion] = useState<StepCompletion>(EMPTY);

  useEffect(() => {
    if (!projectId) {
      setCompletion(EMPTY);
      return;
    }

    let cancelled = false;

    async function check() {
      const [proj, docs, activities, estimates, recs] = await Promise.all([
        supabase.from("projects").select("primary_region").eq("id", projectId!).maybeSingle(),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("project_id", projectId!),
        supabase.from("activities").select("id", { count: "exact", head: true }).eq("project_id", projectId!),
        supabase.from("estimates").select("id", { count: "exact", head: true }).eq("project_id", projectId!),
        supabase.from("recommendations").select("id", { count: "exact", head: true }).eq("project_id", projectId!),
      ]);

      if (cancelled) return;

      const hasSetup = !!(proj.data?.primary_region && String(proj.data.primary_region).trim());
      const hasDocuments = (docs.count ?? 0) > 0;
      const hasActivities = (activities.count ?? 0) > 0;
      const hasEstimates = (estimates.count ?? 0) > 0;
      const hasRecommendations = (recs.count ?? 0) > 0;

      setCompletion({
        setup: hasSetup,
        upload: hasDocuments,
        activities: hasActivities,
        mapping: hasEstimates,
        benchmarking: hasEstimates,
        report: hasEstimates,
        recommendations: hasRecommendations,
      });
    }

    check();
    return () => { cancelled = true; };
  }, [projectId]);

  return completion;
}

/**
 * Fetches step completion for multiple projects (e.g. for dashboard cards).
 * Uses project data for setup; fetches documents, activities, estimates, recommendations in batch.
 */
export async function fetchStepCompletionsForProjects(
  projects: { id: string; primaryRegion?: string }[]
): Promise<Record<string, StepCompletion>> {
  const projectIds = projects.map((p) => p.id).filter(Boolean);
  if (projectIds.length === 0) return {};

  const [docsRows, activitiesRows, estimatesRows, recsRows] = await Promise.all([
    supabase.from("documents").select("project_id").in("project_id", projectIds),
    supabase.from("activities").select("project_id").in("project_id", projectIds),
    supabase.from("estimates").select("project_id").in("project_id", projectIds),
    supabase.from("recommendations").select("project_id").in("project_id", projectIds),
  ]);

  const countByProject = (rows: { project_id: string }[] | null) => {
    const map: Record<string, number> = {};
    for (const r of rows ?? []) {
      map[r.project_id] = (map[r.project_id] ?? 0) + 1;
    }
    return map;
  };

  const docsByProject = countByProject(docsRows.data as { project_id: string }[] | null);
  const activitiesByProject = countByProject(activitiesRows.data as { project_id: string }[] | null);
  const estimatesByProject = countByProject(estimatesRows.data as { project_id: string }[] | null);
  const recsByProject = countByProject(recsRows.data as { project_id: string }[] | null);

  const result: Record<string, StepCompletion> = {};
  for (const proj of projects) {
    const hasSetup = !!(proj.primaryRegion && String(proj.primaryRegion).trim());
    const hasDocuments = (docsByProject[proj.id] ?? 0) > 0;
    const hasActivities = (activitiesByProject[proj.id] ?? 0) > 0;
    const hasEstimates = (estimatesByProject[proj.id] ?? 0) > 0;
    const hasRecommendations = (recsByProject[proj.id] ?? 0) > 0;

    result[proj.id] = {
      setup: hasSetup,
      upload: hasDocuments,
      activities: hasActivities,
      mapping: hasEstimates,
      benchmarking: hasEstimates,
      report: hasEstimates,
      recommendations: hasRecommendations,
    };
  }
  return result;
}

/**
 * Hook to fetch step completions for a list of projects (e.g. dashboard).
 */
export function useProjectStepCompletions(
  projects: { id: string; primaryRegion?: string }[]
): Record<string, StepCompletion> {
  const [completions, setCompletions] = useState<Record<string, StepCompletion>>({});
  const projectIdsKey = projects.map((p) => p.id).sort().join(",");
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  useEffect(() => {
    const current = projectsRef.current;
    if (current.length === 0) {
      setCompletions({});
      return;
    }
    let cancelled = false;
    fetchStepCompletionsForProjects(current).then((data) => {
      if (!cancelled) setCompletions(data);
    });
    return () => { cancelled = true; };
  }, [projectIdsKey]);

  return completions;
}
