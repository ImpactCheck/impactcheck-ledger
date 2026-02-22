import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Check, AlertCircle, Loader2,
  Search, Cpu, BarChart3, FileText, Sparkles,
} from "lucide-react";
import type { JobStatus } from "@/contracts/impactcheck.v2";

// ─── Stage definitions ────────────────────────────────────────────────────────
//
// Each step groups one or more backend stage keys so that both the Gemini path
// and the deterministic fallback path map cleanly to the same stepper visuals.

interface StepDef {
  /** All backend `stage` values that map to this visual step. */
  keys: string[];
  label: string;
  icon: React.ReactNode;
  /** Shown when this step is active and the backend hasn't sent a message yet. */
  defaultDescription: string;
}

const EXTRACT_STEPS: StepDef[] = [
  {
    keys: ["reading_files"],
    label: "Reading files",
    icon: <FileText className="h-4 w-4" />,
    defaultDescription: "Loading uploaded documents from storage…",
  },
  {
    // "extracting"           → Gemini path (sending to API)
    // "extracting_activities"→ deterministic fallback
    // "parsing"              → Gemini path (waiting for response)
    keys: ["extracting", "extracting_activities", "parsing"],
    label: "AI extraction",
    icon: <Sparkles className="h-4 w-4" />,
    defaultDescription: "Gemini is analysing your documents for carbon-relevant line items…",
  },
  {
    keys: ["normalizing_queries"],
    label: "Normalising",
    icon: <Cpu className="h-4 w-4" />,
    defaultDescription: "Mapping activity names to short Climatiq search terms…",
  },
  {
    keys: ["writing_activities"],
    label: "Saving",
    icon: <Check className="h-4 w-4" />,
    defaultDescription: "Storing extracted activities in the database…",
  },
  {
    keys: ["done"],
    label: "Complete",
    icon: <Check className="h-4 w-4" />,
    defaultDescription: "Extraction finished.",
  },
];

const MAPPING_STEPS: StepDef[] = [
  {
    keys: ["loading_activities"],
    label: "Loading",
    icon: <FileText className="h-4 w-4" />,
    defaultDescription: "Fetching extracted activities from the database…",
  },
  {
    keys: ["searching_factors"],
    label: "Searching factors",
    icon: <Search className="h-4 w-4" />,
    defaultDescription: "Matching activities to Climatiq emission factors…",
  },
  {
    keys: ["estimating"],
    label: "Estimating",
    icon: <Cpu className="h-4 w-4" />,
    defaultDescription: "Computing CO₂e values using matched factors…",
  },
  {
    keys: ["ranking"],
    label: "Ranking",
    icon: <BarChart3 className="h-4 w-4" />,
    defaultDescription: "Sorting estimates by emission impact…",
  },
  {
    keys: ["done"],
    label: "Complete",
    icon: <Check className="h-4 w-4" />,
    defaultDescription: "Mapping finished.",
  },
];

const SIMULATION_STEPS: StepDef[] = [
  {
    keys: ["loading_activities"],
    label: "Loading",
    icon: <FileText className="h-4 w-4" />,
    defaultDescription: "Loading activities for regional simulation…",
  },
  {
    keys: ["searching_factors"],
    label: "Searching factors",
    icon: <Search className="h-4 w-4" />,
    defaultDescription: "Finding emission factors for comparison regions…",
  },
  {
    keys: ["estimating"],
    label: "Simulating",
    icon: <Cpu className="h-4 w-4" />,
    defaultDescription: "Computing CO₂e for comparison regions…",
  },
  {
    keys: ["done"],
    label: "Complete",
    icon: <Check className="h-4 w-4" />,
    defaultDescription: "Regional simulation finished.",
  },
];

// ─── Elapsed-time hook ────────────────────────────────────────────────────────

function useElapsedSeconds(job: JobStatus | null): number {
  const [tick, setTick] = useState(0);
  const isRunning = job?.status === "running" || job?.status === "queued";

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  if (!job || !isRunning) return 0;
  const started = new Date(job.createdAt).getTime();
  return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface JobProgressCardProps {
  job: JobStatus;
  type: "extract" | "mapping" | "simulation";
}

export default function JobProgressCard({ job, type }: JobProgressCardProps) {
  const steps = type === "extract" ? EXTRACT_STEPS : type === "simulation" ? SIMULATION_STEPS : MAPPING_STEPS;
  const stageKey = job.stage ?? "";
  const elapsed = useElapsedSeconds(job);

  const isRunning = job.status === "running" || job.status === "queued";
  const isDone = job.status === "succeeded";
  const isFailed = job.status === "failed";

  // Find which step index is active.
  const activeStepIdx = isDone
    ? steps.length - 1
    : steps.findIndex((s) => s.keys.includes(stageKey));
  const currentStep = activeStepIdx >= 0 ? steps[activeStepIdx] : null;

  const description = isFailed
    ? (job.message || "An error occurred. Please retry.")
    : isDone
      ? (job.message || currentStep?.defaultDescription || "Done.")
      : (job.message || currentStep?.defaultDescription || "Processing…");

  return (
    <Card className="border border-border/50 bg-muted/30">
      <CardContent className="pt-5 space-y-4">

        {/* Stage stepper — one segment per step */}
        <div className="flex items-center gap-1">
          {steps.map((step, idx) => {
            const isPast = isDone || idx < activeStepIdx;
            const isCurrent = !isDone && idx === activeStepIdx && isRunning;
            return (
              <div key={step.keys[0]} className="flex items-center flex-1 last:flex-initial gap-1">
                <div
                  className={[
                    "h-1.5 rounded-full flex-1 transition-all duration-700",
                    isPast
                      ? "bg-primary"
                      : isCurrent
                        ? "bg-primary/50 animate-pulse"
                        : "bg-border",
                  ].join(" ")}
                />
              </div>
            );
          })}
        </div>

        {/* Current step label + elapsed + percentage */}
        <div className="flex items-start gap-3">
          <div
            className={[
              "mt-0.5 p-2 rounded-xl shrink-0",
              isFailed
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary",
            ].join(" ")}
          >
            {isFailed ? (
              <AlertCircle className="h-4 w-4" />
            ) : isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              (currentStep?.icon ?? <Check className="h-4 w-4" />)
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold truncate">
                {isFailed ? "Failed" : (currentStep?.label ?? stageKey ?? "Processing")}
              </p>
              <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground font-mono">
                {isRunning && elapsed > 0 && (
                  <span>{formatElapsed(elapsed)}</span>
                )}
                <span>{job.progress}%</span>
              </div>
            </div>

            {/* Description / backend message — never truncated */}
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-words">
              {description}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={job.progress} className="h-2" />

      </CardContent>
    </Card>
  );
}
