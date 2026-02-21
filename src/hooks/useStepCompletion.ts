import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/ProjectContext";

export interface StepCompletion {
  setup: boolean;
  upload: boolean;
  activities: boolean;
  mapping: boolean;
  report: boolean;
  recommendations: boolean;
  deploy: boolean;
}

const EMPTY: StepCompletion = {
  setup: false,
  upload: false,
  activities: false,
  mapping: false,
  report: false,
  recommendations: false,
  deploy: false,
};

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
      const [docs, activities, estimates] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("project_id", projectId!),
        supabase.from("activities").select("id", { count: "exact", head: true }).eq("project_id", projectId!),
        supabase.from("estimates").select("id", { count: "exact", head: true }).eq("project_id", projectId!),
      ]);

      if (cancelled) return;

      const hasDocuments = (docs.count ?? 0) > 0;
      const hasActivities = (activities.count ?? 0) > 0;
      const hasEstimates = (estimates.count ?? 0) > 0;

      setCompletion({
        setup: true, // If we have a projectId, setup is done
        upload: hasDocuments,
        activities: hasActivities,
        mapping: hasEstimates,
        report: hasEstimates, // Report can be generated once estimates exist
        recommendations: hasEstimates,
        deploy: hasEstimates,
      });
    }

    check();
    return () => { cancelled = true; };
  }, [projectId]);

  return completion;
}
