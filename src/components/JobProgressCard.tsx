import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Check, AlertCircle, Loader2, Search, Cpu, BarChart3, FileText, Sparkles } from "lucide-react";
import type { JobStatus } from "@/contracts/impactcheck.v2";

interface JobProgressCardProps {
  job: JobStatus;
  type: "extract" | "mapping";
}

const EXTRACT_STAGES: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  loading_activities: { label: "Loading documents", icon: <FileText className="h-4 w-4" />, description: "Reading uploaded files…" },
  extracting: { label: "Extracting activities", icon: <Sparkles className="h-4 w-4" />, description: "AI is parsing your documents for carbon-relevant line items…" },
  saving: { label: "Saving results", icon: <Check className="h-4 w-4" />, description: "Storing extracted activities…" },
  done: { label: "Complete", icon: <Check className="h-4 w-4" />, description: "Extraction finished successfully." },
};

const MAPPING_STAGES: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  loading_activities: { label: "Loading activities", icon: <FileText className="h-4 w-4" />, description: "Fetching activities from the database…" },
  searching_factors: { label: "Searching emission factors", icon: <Search className="h-4 w-4" />, description: "Matching activities to Climatiq emission factors…" },
  estimating: { label: "Computing estimates", icon: <Cpu className="h-4 w-4" />, description: "Calculating CO₂e values using matched factors…" },
  ranking: { label: "Ranking results", icon: <BarChart3 className="h-4 w-4" />, description: "Sorting and ranking emission estimates…" },
  done: { label: "Complete", icon: <Check className="h-4 w-4" />, description: "Mapping finished successfully." },
};

export default function JobProgressCard({ job, type }: JobProgressCardProps) {
  const stages = type === "extract" ? EXTRACT_STAGES : MAPPING_STAGES;
  const stageKey = job.stage ?? "loading_activities";
  const stageInfo = stages[stageKey] ?? { label: stageKey, icon: <Loader2 className="h-4 w-4 animate-spin" />, description: "Processing…" };

  const isRunning = job.status === "running" || job.status === "queued";
  const isDone = job.status === "succeeded";
  const isFailed = job.status === "failed";

  const stageKeys = Object.keys(stages);
  const currentStageIndex = stageKeys.indexOf(stageKey);

  return (
    <Card className="border border-border/50 bg-muted/30">
      <CardContent className="pt-5 space-y-4">
        {/* Stage stepper */}
        <div className="flex items-center gap-1">
          {stageKeys.map((key, idx) => {
            const isPast = idx < currentStageIndex || isDone;
            const isCurrent = idx === currentStageIndex && isRunning;
            return (
              <div key={key} className="flex items-center flex-1 last:flex-initial">
                <div
                  className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
                    isPast ? "bg-primary" : isCurrent ? "bg-primary/50 animate-pulse" : "bg-border"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Current stage info */}
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 p-2 rounded-xl ${isDone ? "bg-primary/10 text-primary" : isFailed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {isFailed ? (
              <AlertCircle className="h-4 w-4" />
            ) : isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              stageInfo.icon
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {isFailed ? "Failed" : isDone ? stageInfo.label : stageInfo.label}
              </p>
              <span className="text-xs font-mono text-muted-foreground">{job.progress}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFailed ? (job.message || "An error occurred. Please retry.") : isDone ? (job.message || stageInfo.description) : stageInfo.description}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={job.progress} className="h-2" />

        {/* Message from backend */}
        {isRunning && job.message && (
          <p className="text-[11px] text-muted-foreground font-mono truncate">{job.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
