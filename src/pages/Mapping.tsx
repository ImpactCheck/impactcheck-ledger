import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, Info, GitMerge, X, Database, Flag, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { ActivityEstimate, ExtractedActivity } from "@/contracts/impactcheck.v2";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStepCompletion } from "@/hooks/useStepCompletion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import JobProgressCard from "@/components/JobProgressCard";
import { useJobPoller } from "@/hooks/useJobPoller";
import { cn } from "@/lib/utils";

import { REGION_LABELS } from "@/lib/regions";

function ConfidenceDot({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  const textColor =
    pct >= 80 ? "text-green-600 dark:text-green-400" : pct >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full shrink-0", color)} />
      <span className={cn("text-xs font-mono font-semibold", textColor)}>{pct}%</span>
    </div>
  );
}

function isReviewNeeded(est: ActivityEstimate): boolean {
  const qty = est.inputUsed?.quantity || 1;
  const unitCo2e = est.co2eKg / qty;
  const isPower = est.inputUsed?.unit_type === "Power";
  return unitCo2e > 10000 && !isPower && est.confidence < 0.7;
}

export default function Mapping() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";
  const completion = useStepCompletion();
  const canRunMapping = completion.setup && completion.upload && completion.activities;
  const allRegions = [project.primaryRegion, ...project.comparisonRegions].filter(Boolean);
  const isMultiRegion = allRegions.length > 1;

  const [estimates, setEstimates] = useState<ActivityEstimate[]>([]);
  const [activities, setActivities] = useState<ExtractedActivity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState(allRegions[0] ?? "all");
  const [filterTab, setFilterTab] = useState<"all" | "high" | "review">("all");
  const [selectedEst, setSelectedEst] = useState<ActivityEstimate | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

  const autoStartedRef = useRef(false);

  const loadEstimates = useCallback(() => {
    api.getEstimates(projectId).then((est) => {
      setEstimates(est);
      setLoaded(true);
    });
    api.getActivities(projectId).then(setActivities);
  }, [projectId]);

  const { job, start: startMapping, isRunning: jobRunning } = useJobPoller({
    projectId,
    jobType: "mapping",
    onSuccess: loadEstimates,
  });

  useEffect(() => { loadEstimates(); }, [loadEstimates]);

  const handleMapping = useCallback(() => {
    startMapping(() => api.startMapping(projectId));
  }, [startMapping, projectId]);

  useEffect(() => {
    if (
      loaded &&
      !autoStartedRef.current &&
      !job &&
      !jobRunning &&
      estimates.length === 0 &&
      canRunMapping
    ) {
      autoStartedRef.current = true;
      handleMapping();
    }
  }, [loaded, job, jobRunning, estimates.length, canRunMapping, handleMapping]);

  const jobDone = job?.status === "succeeded";
  const jobFailed = job?.status === "failed";
  const hasEstimates = estimates.length > 0;

  const reviewCount = estimates.filter(isReviewNeeded).length;

  const regionFiltered = isMultiRegion && activeTab !== "all"
    ? estimates.filter((e) => e.region === activeTab)
    : estimates;

  const displayEstimates = filterTab === "high"
    ? regionFiltered.filter((e) => e.confidence >= 0.8)
    : filterTab === "review"
      ? regionFiltered.filter(isReviewNeeded)
      : regionFiltered;

  const isAutoLoading = loaded && !hasEstimates && (jobRunning || (autoStartedRef.current && !job));

  const acceptedCount = acceptedIds.size;
  const pendingCount = estimates.length - acceptedCount;

  const handleAccept = (e: React.MouseEvent, est: ActivityEstimate) => {
    e.stopPropagation();
    const key = `${est.activityId}-${est.region}`;
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedActivity = selectedEst
    ? activities.find((a) => a.id === selectedEst.activityId)
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="step-number mb-1">Step 04</p>
          <h1 className="text-2xl font-bold tracking-tight">Mapping & Factors</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Review emission factor matches and CO₂e estimates per activity.
          </p>
        </div>
        {jobDone && hasEstimates && (
          <span className="badge-ai">AI MATCHING COMPLETE</span>
        )}
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Main panel ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitMerge className="h-4 w-4 text-primary" />
                Climatiq Factor Mapping
              </CardTitle>
              <CardDescription>
                {hasEstimates
                  ? `${estimates.length} factors matched · ${reviewCount > 0 ? `${reviewCount} need review` : "all verified"}`
                  : canRunMapping
                    ? "Matching activities to emission factors via Climatiq…"
                    : "Complete Setup, Upload, and Emissions steps first."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canRunMapping && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Complete the previous steps (Setup, Upload, and Emissions Calculation) before running mapping.
                  </AlertDescription>
                </Alert>
              )}

              {isAutoLoading && !job && canRunMapping && (
                <div className="auto-start-banner flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary">Starting mapping automatically…</p>
                    <p className="text-xs text-muted-foreground">Activities are ready — kicking off Climatiq factor matching</p>
                  </div>
                </div>
              )}

              {job && <JobProgressCard job={job} type="mapping" />}

              {jobFailed && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <X className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">Mapping failed. Please retry.</p>
                </div>
              )}

              {!jobRunning && loaded && (
                <Button
                  onClick={handleMapping}
                  variant={hasEstimates ? "outline" : "default"}
                  className="gap-2 rounded-xl"
                  disabled={jobRunning || !canRunMapping}
                >
                  {hasEstimates ? "Re-run Mapping" : jobFailed ? "Retry Mapping" : "Run Climatiq Mapping"}
                </Button>
              )}

              {jobRunning && (
                <Button disabled className="gap-2 rounded-xl">
                  <Loader2 className="h-4 w-4 animate-spin" /> Mapping…
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Filter tabs */}
          {hasEstimates && (
            <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as typeof filterTab)}>
              <TabsList className="rounded-xl">
                <TabsTrigger value="all" className="rounded-lg">All ({estimates.length})</TabsTrigger>
                <TabsTrigger value="high" className="rounded-lg">
                  High Confidence ({estimates.filter((e) => e.confidence >= 0.8).length})
                </TabsTrigger>
                <TabsTrigger value="review" className="rounded-lg">
                  {reviewCount > 0 && (
                    <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
                  )}
                  Review Needed ({reviewCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Estimates table */}
          {hasEstimates && (
            isMultiRegion ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="rounded-xl">
                  <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
                  {allRegions.map((r) => (
                    <TabsTrigger key={r} value={r} className="rounded-lg">
                      {REGION_LABELS[r] ?? r.replace(/_/g, " ")}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value={activeTab} className="mt-4">
                  <EstimatesTable
                    estimates={displayEstimates}
                    selectedEst={selectedEst}
                    acceptedIds={acceptedIds}
                    onSelect={setSelectedEst}
                    onAccept={handleAccept}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <EstimatesTable
                estimates={displayEstimates}
                selectedEst={selectedEst}
                acceptedIds={acceptedIds}
                onSelect={setSelectedEst}
                onAccept={handleAccept}
              />
            )
          )}

          {/* Footer bar */}
          {hasEstimates && (
            <div className="flex items-center justify-between rounded-2xl bg-muted/40 border border-border/60 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-primary">{acceptedCount}</span> accepted ·{" "}
                <span className="font-semibold text-foreground">{pendingCount}</span> pending
                {reviewCount > 0 && (
                  <> · <span className="font-semibold text-amber-600 dark:text-amber-400">{reviewCount} ⚠</span></>
                )}
              </span>
              <Button onClick={() => navigate("/benchmarking")} className="gap-2 rounded-xl">
                Review & Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => navigate("/emissions")} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={() => navigate("/benchmarking")} disabled={!hasEstimates} className="gap-2 rounded-xl">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Right match details panel ──────────────────────────── */}
        <div className="w-64 shrink-0 hidden lg:block">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 sticky top-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Match Details</p>
            {selectedEst ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{selectedEst.matchedFactor.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{selectedEst.matchedFactor.source} · {selectedEst.matchedFactor.year}</p>
                </div>

                {/* Input used detail */}
                {selectedEst.inputUsed && (
                  <div className="space-y-1.5 rounded-xl bg-muted/50 px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Input Used</p>
                    {selectedEst.inputUsed.unit_type && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Unit Type</span>
                        <span className="font-mono">{selectedEst.inputUsed.unit_type}</span>
                      </div>
                    )}
                    {selectedEst.inputUsed.quantity != null && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Quantity</span>
                        <span className="font-mono">{selectedEst.inputUsed.quantity}</span>
                      </div>
                    )}
                    {selectedEst.inputUsed.note && (
                      <p className="text-[10px] text-muted-foreground italic">{selectedEst.inputUsed.note}</p>
                    )}
                  </div>
                )}

                {/* Review flag */}
                {isReviewNeeded(selectedEst) && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">High Per-Unit Value</p>
                      <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                        CO₂e per unit exceeds 10,000 kg. Review quantity and unit type.
                      </p>
                    </div>
                  </div>
                )}

                {/* Source activity */}
                {selectedActivity && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Source Activity</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{selectedActivity.text}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 rounded-xl bg-primary/8 border border-primary/15 px-3 py-2">
                  <Database className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-primary">Climatiq DB</p>
                    <p className="text-[10px] text-muted-foreground truncate font-mono">{selectedEst.matchedFactor.source}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full rounded-xl text-xs gap-1.5" disabled>
                    Change Match Manually
                  </Button>
                  <button className="w-full text-[11px] text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5 transition-colors">
                    <Flag className="h-3 w-3" /> Flag as Incorrect
                  </button>
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">CO₂e</span>
                    <span className="font-mono font-bold text-primary">{formatTonnes(selectedEst.co2eKg)} t</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-muted-foreground">Confidence</span>
                    <ConfidenceDot value={selectedEst.confidence} />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <GitMerge className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Click a row to see match details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EstimatesTable({
  estimates,
  selectedEst,
  acceptedIds,
  onSelect,
  onAccept,
}: {
  estimates: ActivityEstimate[];
  selectedEst: ActivityEstimate | null;
  acceptedIds: Set<string>;
  onSelect: (est: ActivityEstimate) => void;
  onAccept: (e: React.MouseEvent, est: ActivityEstimate) => void;
}) {
  return (
    <Card className="card-elevated border-0 overflow-hidden">
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">Activity Source</TableHead>
              <TableHead>AI Suggested Match</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="text-right">CO₂e</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estimates.map((est) => {
              const key = `${est.activityId}-${est.region}`;
              const isSelected = selectedEst?.activityId === est.activityId && selectedEst?.region === est.region;
              const isAccepted = acceptedIds.has(key);
              const needsReview = isReviewNeeded(est);
              return (
                <TableRow
                  key={key}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isSelected && "bg-primary/5 hover:bg-primary/8",
                    !isSelected && "hover:bg-muted/40",
                    needsReview && "border-l-2 border-l-amber-400"
                  )}
                  onClick={() => onSelect(est)}
                >
                  <TableCell className="max-w-[140px]">
                    <p className="text-xs font-mono text-muted-foreground truncate">{est.activityId}</p>
                    {est.region && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {REGION_LABELS[est.region] ?? est.region.replace(/_/g, " ")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium leading-snug">{est.matchedFactor.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {est.matchedFactor.source} · {est.matchedFactor.year}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ConfidenceDot value={est.confidence} />
                      {needsReview && (
                        <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                          ⚠ REVIEW
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-sm text-primary">
                    {formatTonnes(est.co2eKg)} t
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={(e) => onAccept(e, est)}
                      className={cn(
                        "text-[10px] font-semibold rounded-full px-2.5 py-1 transition-all border cursor-pointer",
                        isAccepted
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                      )}
                    >
                      {isAccepted ? "✓ Accepted" : "Accept"}
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
