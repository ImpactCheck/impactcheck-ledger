import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import type { JobStatus } from "@/contracts/impactcheck.v2";

const POLL_INTERVAL_MS = 1500;

/**
 * Encapsulates the start → poll → stop lifecycle for a backend job.
 * Supports auto-resuming in-progress jobs when the user navigates back.
 *
 * Usage:
 *   const { job, start, isRunning } = useJobPoller({
 *     projectId,
 *     jobType: "extract",
 *     onSuccess: loadData,
 *   });
 */
export function useJobPoller(options?: {
  projectId?: string;
  jobType?: string;
  onSuccess?: (job: JobStatus) => void;
}) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSuccessRef = useRef(options?.onSuccess);
  useEffect(() => { onSuccessRef.current = options?.onSuccess; });

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const startPolling = useCallback((jobId: string) => {
    stop();
    intervalRef.current = setInterval(async () => {
      try {
        const updated = await api.getJob(jobId);
        setJob(updated);
        if (updated.status === "succeeded" || updated.status === "failed") {
          stop();
          if (updated.status === "succeeded") onSuccessRef.current?.(updated);
        }
      } catch {
        // Swallow transient network errors — keep polling.
      }
    }, POLL_INTERVAL_MS);
  }, [stop]);

  const start = useCallback(async (starter: () => Promise<JobStatus>) => {
    stop();
    const initial = await starter();
    setJob(initial);
    if (initial.status === "succeeded" || initial.status === "failed") {
      if (initial.status === "succeeded") onSuccessRef.current?.(initial);
      return;
    }
    startPolling(initial.id);
  }, [stop, startPolling]);

  const resume = useCallback(async (jobId: string) => {
    stop();
    try {
      const current = await api.getJob(jobId);
      setJob(current);
      if (current.status === "succeeded" || current.status === "failed") {
        if (current.status === "succeeded") onSuccessRef.current?.(current);
        return;
      }
      startPolling(jobId);
    } catch {
      // Job not found or network error — ignore.
    }
  }, [stop, startPolling]);

  // Auto-resume: on mount, check for an active job matching projectId + jobType
  const hasAutoResumed = useRef(false);
  useEffect(() => {
    const projectId = options?.projectId;
    const jobType = options?.jobType;
    if (!projectId || !jobType || hasAutoResumed.current) return;
    hasAutoResumed.current = true;

    api.getActiveJob(projectId, jobType).then((activeJob) => {
      if (activeJob) {
        setJob(activeJob);
        if (activeJob.status === "succeeded" || activeJob.status === "failed") {
          if (activeJob.status === "succeeded") onSuccessRef.current?.(activeJob);
        } else {
          startPolling(activeJob.id);
        }
      }
    }).catch(() => {/* ignore */});
  }, [options?.projectId, options?.jobType, startPolling]);

  const isRunning = job?.status === "running" || job?.status === "queued";

  return { job, start, resume, isRunning };
}
