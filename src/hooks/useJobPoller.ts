import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import type { JobStatus } from "@/contracts/impactcheck.v2";

const POLL_INTERVAL_MS = 1500;

/**
 * Encapsulates the start → poll → stop lifecycle for a backend job.
 *
 * Usage:
 *   const { job, start, isRunning } = useJobPoller({ onSuccess: loadData });
 *   // trigger:
 *   await start(() => api.startExtract(projectId));
 */
export function useJobPoller(options?: { onSuccess?: (job: JobStatus) => void }) {
  const [job, setJob] = useState<JobStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep callback in a ref so `start` stays stable even if onSuccess changes.
  const onSuccessRef = useRef(options?.onSuccess);
  useEffect(() => { onSuccessRef.current = options?.onSuccess; });

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Always clean up the interval on unmount.
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

  /**
   * Call `starter` to kick off a job, then begin polling.
   * If the job is already terminal when `starter` resolves (synchronous
   * edge-function path), polling is skipped and `onSuccess` fires immediately.
   */
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

  /**
   * Resume polling for a job whose ID is already known (e.g. after a page
   * navigation). Fetches current state immediately, then polls if still running.
   */
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

  const isRunning = job?.status === "running" || job?.status === "queued";

  return { job, start, resume, isRunning };
}
