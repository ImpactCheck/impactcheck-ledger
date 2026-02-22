import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ArrowRight, Loader2, Sparkles, X, Check,
  AlertTriangle, Save, Zap, Database, ChevronDown, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { ExtractedActivity, ActivityEstimate, UnitType } from "@/contracts/impactcheck.v2";
import { getActivityPhase, formatTonnes } from "@/contracts/impactcheck.v2";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import JobProgressCard from "@/components/JobProgressCard";
import { useJobPoller } from "@/hooks/useJobPoller";
import { useStepCompletion } from "@/hooks/useStepCompletion";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const UNIT_TYPES: UnitType[] = [
  "Weight", "Energy", "Power", "Volume", "Area", "Distance", "Money", "Number",
  "Data", "Time", "WeightOverDistance", "ContainerOverDistance", "PassengerOverDistance",
  "AreaOverTime", "DataOverTime", "DistanceOverTime", "NumberOverTime", "WeightOverTime",
];

const CATEGORIES = [
  "HARDWARE", "ENERGY", "TRANSPORT", "COMPUTE",
  "CONSTRUCTION", "OPERATIONS", "PROCUREMENT", "OTHER",
];

const REGION_LABELS: Record<string, string> = {
  texas_ercot: "Texas (ERCOT)",
  norway_hydro: "Norway (Hydro)",
  virginia_pjm: "Virginia (PJM)",
  iowa_miso: "Iowa (MISO)",
  iceland_geo: "Iceland (Geo)",
  singapore: "Singapore",
};

const CATEGORY_STYLES: Record<string, string> = {
  HARDWARE:     "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  ENERGY:       "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  TRANSPORT:    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  COMPUTE:      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  CONSTRUCTION: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  OPERATIONS:   "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  PROCUREMENT:  "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
};

function getCategoryStyle(cat?: string) {
  if (!cat) return "bg-muted text-muted-foreground";
  return CATEGORY_STYLES[cat.toUpperCase()] ?? "bg-muted text-muted-foreground";
}

function isReviewNeeded(est: ActivityEstimate): boolean {
  const qty = est.inputUsed?.quantity || 1;
  const unitCo2e = est.co2eKg / qty;
  return unitCo2e > 10000 && est.inputUsed?.unit_type !== "Power" && est.confidence < 0.7;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseBadge({ phase, category }: { phase?: "embodied" | "operational"; category?: string }) {
  const resolved = phase ?? getActivityPhase(category);
  return resolved === "embodied" ? (
    <Badge className="text-[10px] rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100">
      EMBODIED
    </Badge>
  ) : (
    <Badge className="text-[10px] rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-100">
      OPERATIONAL
    </Badge>
  );
}

function ConfidenceDot({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 80
    ? "text-green-600 dark:text-green-400"
    : pct >= 60 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full shrink-0", color)} />
      <span className={cn("text-xs font-mono font-semibold", textColor)}>{pct}%</span>
    </div>
  );
}

// ─── Expanded edit row ────────────────────────────────────────────────────────

function ExpandedRow({
  act,
  est,
  allRegions,
  onUpdate,
  onRemapNeeded,
}: {
  act: ExtractedActivity;
  est: ActivityEstimate | undefined;
  allRegions: string[];
  onUpdate: (id: string, field: keyof ExtractedActivity, value: string | number | undefined) => void;
  onRemapNeeded: () => void;
}) {
  const needsReview = est ? isReviewNeeded(est) : false;

  const handleEdit = (field: keyof ExtractedActivity, value: string | number | undefined) => {
    onUpdate(act.id, field, value);
    // Fields that affect mapping quality → flag remap
    if (["unit_type", "quantity", "region", "category"].includes(field as string)) {
      onRemapNeeded();
    }
  };

  return (
    <TableRow>
      <TableCell colSpan={9} className="bg-muted/20 p-0">
        <div className="p-4 space-y-4 border-l-2 border-primary/30">
          {/* Activity edit fields */}
          <div className="grid grid-cols-3 gap-3">
            {/* Description */}
            <div className="col-span-3 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Description
              </label>
              <Textarea
                value={act.text}
                onChange={(e) => handleEdit("text", e.target.value)}
                className="min-h-[2.5rem] text-sm resize-none rounded-lg"
                rows={2}
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Category
              </label>
              <Select
                value={act.category?.toUpperCase() ?? ""}
                onValueChange={(v) => handleEdit("category", v || undefined)}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phase override */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Phase
              </label>
              <Select
                value={act.phase ?? ""}
                onValueChange={(v) => handleEdit("phase", v as "embodied" | "operational" | undefined || undefined)}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg">
                  <SelectValue placeholder="AI classified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="embodied" className="text-xs">Embodied</SelectItem>
                  <SelectItem value="operational" className="text-xs">Operational</SelectItem>
                </SelectContent>
              </Select>
              {act.phaseReason && (
                <p className="text-[10px] text-muted-foreground italic leading-tight mt-0.5">
                  AI: {act.phaseReason}
                </p>
              )}
            </div>

            {/* Region */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Region
              </label>
              <Select
                value={act.region ?? ""}
                onValueChange={(v) => handleEdit("region", v || undefined)}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  {allRegions.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {REGION_LABELS[r] ?? r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Quantity
              </label>
              <Input
                type="number"
                value={act.quantity ?? ""}
                onChange={(e) => handleEdit("quantity", e.target.value ? parseFloat(e.target.value) : undefined)}
                className="h-8 text-xs rounded-lg font-mono"
                placeholder="—"
              />
            </div>

            {/* Unit */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Unit
              </label>
              <Input
                type="text"
                value={act.unit ?? ""}
                onChange={(e) => handleEdit("unit", e.target.value || undefined)}
                className="h-8 text-xs rounded-lg font-mono"
                placeholder="e.g. kWh, units"
              />
            </div>

            {/* Unit Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Unit Type
              </label>
              <Select
                value={act.unit_type ?? ""}
                onValueChange={(v) => handleEdit("unit_type", v || undefined)}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg">
                  <SelectValue placeholder="Unit type" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map((ut) => (
                    <SelectItem key={ut} value={ut} className="text-xs">{ut}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estimate details */}
          {est && (
            <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Emission Factor Match
                </p>
                <ConfidenceDot value={est.confidence} />
                {needsReview && (
                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                    ⚠ REVIEW
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Factor</span>
                  <span className="font-medium truncate max-w-[180px] text-right">{est.matchedFactor.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-mono">{est.matchedFactor.source} · {est.matchedFactor.year}</span>
                </div>
                {est.inputUsed?.unit_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input Unit Type</span>
                    <span className="font-mono">{est.inputUsed.unit_type}</span>
                  </div>
                )}
                {est.inputUsed?.quantity != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input Qty</span>
                    <span className="font-mono">{est.inputUsed.quantity.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between col-span-2 border-t border-border pt-1.5 mt-0.5">
                  <span className="text-muted-foreground">Annual CO₂e</span>
                  <span className="font-mono font-bold text-primary">{formatTonnes(est.co2eKg)} t</span>
                </div>
              </div>
              {needsReview && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-300">
                    CO₂e per unit exceeds 10,000 kg with low confidence — review the quantity and unit type above.
                  </p>
                </div>
              )}
              {est.inputUsed?.note && (
                <p className="text-[10px] text-muted-foreground italic">{est.inputUsed.note}</p>
              )}
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Pipeline step indicator ──────────────────────────────────────────────────

type PipelineStage = "idle" | "extracting" | "classifying" | "mapping" | "done";

const STAGE_ORDER: Record<PipelineStage, number> = {
  idle: -1, extracting: 0, classifying: 1, mapping: 2, done: 3,
};

function PipelineSteps({ stage }: { stage: PipelineStage }) {
  const steps = ["Extract", "Classify", "Map"];
  const current = STAGE_ORDER[stage] ?? -1;
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      {steps.map((s, i) => {
        const isDone = current > i;
        const isActive = current === i;
        return (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className={cn("h-px w-6", isDone ? "bg-primary" : "bg-border")} />}
            <span className={cn(
              "px-2.5 py-1 rounded-full border transition-colors",
              isDone  && "bg-primary/10 border-primary/25 text-primary",
              isActive && "bg-primary text-primary-foreground border-primary",
              !isDone && !isActive && "bg-muted border-border text-muted-foreground",
            )}>
              {isDone ? <><Check className="h-3 w-3 inline mr-1" />{s}</> : s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmissionsCalculation() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";
  const completion = useStepCompletion();

  const allRegions = [project.primaryRegion, ...project.comparisonRegions].filter(Boolean);

  // Data state
  const [activities, setActivities] = useState<ExtractedActivity[]>([]);
  const [estimates, setEstimates] = useState<ActivityEstimate[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [estimatesLoaded, setEstimatesLoaded] = useState(false);

  // UI state
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<"all" | "embodied" | "operational">("all");
  const [qualityFilter, setQualityFilter] = useState<"all" | "high" | "review">("all");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remapNeeded, setRemapNeeded] = useState(false);

  const autoStartedRef = useRef(false);
  const mappingAutoStartedRef = useRef(false);

  // Data loaders
  const loadActivities = useCallback(() => {
    api.getActivities(projectId).then((acts) => {
      setActivities(acts);
      setActivitiesLoaded(true);
    });
  }, [projectId]);

  const loadEstimates = useCallback(() => {
    api.getEstimates(projectId).then((ests) => {
      setEstimates(ests);
      setEstimatesLoaded(true);
    });
  }, [projectId]);

  useEffect(() => {
    loadActivities();
    loadEstimates();
  }, [loadActivities, loadEstimates]);

  // Job pollers
  const { job: extractJob, start: startExtract, isRunning: extractRunning } = useJobPoller({
    projectId,
    jobType: "extract",
    onSuccess: () => {
      loadActivities();
      setStage("classifying");
    },
  });

  const { job: mappingJob, start: startMapping, isRunning: mappingRunning } = useJobPoller({
    projectId,
    jobType: "mapping",
    onSuccess: () => {
      loadEstimates();
      setStage("done");
      setRemapNeeded(false);
    },
  });

  // Handlers
  const handleExtract = useCallback(() => {
    setStage("extracting");
    autoStartedRef.current = true;
    mappingAutoStartedRef.current = false;
    startExtract(() => api.startExtract(projectId));
  }, [startExtract, projectId]);

  const handleMapping = useCallback(() => {
    setStage("mapping");
    mappingAutoStartedRef.current = true;
    startMapping(() => api.startMapping(projectId));
  }, [startMapping, projectId]);

  // Auto-start: extract if no activities yet
  useEffect(() => {
    if (
      activitiesLoaded && estimatesLoaded &&
      !autoStartedRef.current &&
      !extractJob && !extractRunning &&
      !mappingJob && !mappingRunning &&
      activities.length === 0 && estimates.length === 0 &&
      completion.upload
    ) {
      autoStartedRef.current = true;
      handleExtract();
    }
  }, [activitiesLoaded, estimatesLoaded, extractJob, extractRunning, mappingJob, mappingRunning,
    activities.length, estimates.length, completion.upload, handleExtract]);

  // Auto-start mapping after extraction
  useEffect(() => {
    if (
      activitiesLoaded &&
      extractJob?.status === "succeeded" &&
      !mappingAutoStartedRef.current &&
      !mappingJob && !mappingRunning &&
      estimates.length === 0 && activities.length > 0
    ) {
      mappingAutoStartedRef.current = true;
      handleMapping();
    }
  }, [activitiesLoaded, extractJob?.status, mappingJob, mappingRunning,
    estimates.length, activities.length, handleMapping]);

  // Stage tracking
  useEffect(() => {
    if (extractRunning || extractJob?.status === "queued") setStage("extracting");
    else if (mappingRunning || mappingJob?.status === "queued") setStage("mapping");
    else if (estimates.length > 0 || activities.length > 0) setStage("done");
  }, [extractRunning, mappingRunning, extractJob?.status, mappingJob?.status,
    estimates.length, activities.length]);

  // Field editor
  const updateField = (id: string, field: keyof ExtractedActivity, value: string | number | undefined) => {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateActivities(projectId, activities);
      setActivities(updated);
      setDirty(false);
      toast.success("Activities saved");
    } finally {
      setSaving(false);
    }
  };

  // Derived values
  const phaseCounts = useMemo(() => {
    const embodied = activities.filter(
      (a) => (a.phase ?? getActivityPhase(a.category)) === "embodied"
    ).length;
    return { embodied, operational: activities.length - embodied };
  }, [activities]);

  const avgConfidence = useMemo(() => {
    if (!estimates.length) return 0;
    return Math.round((estimates.reduce((s, e) => s + e.confidence, 0) / estimates.length) * 100);
  }, [estimates]);

  const reviewCount = useMemo(() => estimates.filter(isReviewNeeded).length, [estimates]);

  const totalCo2e = useMemo(() => estimates.reduce((s, e) => s + e.co2eKg, 0), [estimates]);

  const embodiedPct = activities.length > 0
    ? Math.round((phaseCounts.embodied / activities.length) * 100) : 0;
  const operationalPct = 100 - embodiedPct;

  // Filtered rows
  const filteredActivities = useMemo(() => {
    let list = activities;
    if (phaseFilter !== "all") {
      list = list.filter(
        (a) => (a.phase ?? getActivityPhase(a.category)) === phaseFilter
      );
    }
    if (qualityFilter === "high") {
      list = list.filter((a) => {
        const est = estimates.find((e) => e.activityId === a.id);
        return est ? est.confidence >= 0.8 : false;
      });
    } else if (qualityFilter === "review") {
      list = list.filter((a) => {
        const est = estimates.find((e) => e.activityId === a.id);
        return est ? isReviewNeeded(est) : false;
      });
    }
    return list;
  }, [activities, estimates, phaseFilter, qualityFilter]);

  const isRunning = extractRunning || mappingRunning;
  const extractFailed = extractJob?.status === "failed";
  const mappingFailed = mappingJob?.status === "failed";
  const bothDone = stage === "done" && activities.length > 0;
  const isAutoLoading = activitiesLoaded && activities.length === 0 &&
    (extractRunning || (autoStartedRef.current && !extractJob));

  const activeJob = extractRunning || extractJob?.status === "queued" ? extractJob
    : mappingRunning || mappingJob?.status === "queued" ? mappingJob
    : null;
  const activeJobType: "extract" | "mapping" = (mappingRunning || mappingJob?.status === "queued") ? "mapping" : "extract";

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="step-number mb-1">Step 03</p>
          <h1 className="text-2xl font-bold tracking-tight">Emissions & Mapping</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            AI extracts activities, classifies phases, and calculates CO₂e — review and edit every row.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bothDone && <span className="badge-ai">AI COMPLETE</span>}
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 rounded-xl">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Main panel ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Pipeline card */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                AI Calculation Pipeline
              </CardTitle>
              <CardDescription>
                {bothDone
                  ? `${activities.length} activities · ${estimates.length} estimates · ${reviewCount > 0 ? `${reviewCount} need review` : "all verified"}`
                  : completion.upload
                    ? "Processing your documents end-to-end…"
                    : "Upload documents in the previous step to begin."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PipelineSteps stage={stage} />

              {isAutoLoading && !activeJob && (
                <div className="auto-start-banner flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary">Starting automatically…</p>
                    <p className="text-xs text-muted-foreground">Detected uploaded documents — kicking off AI extraction</p>
                  </div>
                </div>
              )}

              {stage === "classifying" && !mappingRunning && !mappingJob && (
                <div className="auto-start-banner flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary">Starting factor mapping…</p>
                    <p className="text-xs text-muted-foreground">Extraction done — calculating CO₂e via Climatiq</p>
                  </div>
                </div>
              )}

              {activeJob && <JobProgressCard job={activeJob} type={activeJobType} />}

              {extractFailed && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <X className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">Extraction failed.</p>
                  <Button size="sm" variant="outline" onClick={handleExtract} className="ml-auto rounded-xl">Retry</Button>
                </div>
              )}
              {mappingFailed && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <X className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">Factor mapping failed.</p>
                  <Button size="sm" variant="outline" onClick={handleMapping} className="ml-auto rounded-xl">Retry</Button>
                </div>
              )}

              {!isRunning && activitiesLoaded && !isAutoLoading && activities.length === 0 && !extractFailed && (
                <Button onClick={handleExtract} className="gap-2 rounded-xl">Run Extraction</Button>
              )}

              {bothDone && !isRunning && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleExtract} className="gap-1.5 rounded-xl">
                    Re-run Extraction
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleMapping} className="gap-1.5 rounded-xl">
                    Recalculate Estimates
                  </Button>
                </div>
              )}

              {remapNeeded && bothDone && !isRunning && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                      Activity edits may affect estimates — save then recalculate.
                    </p>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { if (dirty) handleSave().then(() => handleMapping()); else handleMapping(); }}
                    className="rounded-xl text-xs shrink-0"
                  >
                    Save & Recalculate
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity + Estimate table */}
          {activities.length > 0 && (
            <>
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-3">
                <Tabs value={phaseFilter} onValueChange={(v) => setPhaseFilter(v as typeof phaseFilter)}>
                  <TabsList className="rounded-xl h-8">
                    <TabsTrigger value="all" className="rounded-lg text-xs px-3">
                      All ({activities.length})
                    </TabsTrigger>
                    <TabsTrigger value="embodied" className="rounded-lg text-xs px-3">
                      Embodied / Year 1 ({phaseCounts.embodied})
                    </TabsTrigger>
                    <TabsTrigger value="operational" className="rounded-lg text-xs px-3">
                      Operational / annual ({phaseCounts.operational})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {estimates.length > 0 && (
                  <Tabs value={qualityFilter} onValueChange={(v) => setQualityFilter(v as typeof qualityFilter)}>
                    <TabsList className="rounded-xl h-8">
                      <TabsTrigger value="all" className="rounded-lg text-xs px-3">All Quality</TabsTrigger>
                      <TabsTrigger value="high" className="rounded-lg text-xs px-3">
                        High Conf ({estimates.filter((e) => e.confidence >= 0.8).length})
                      </TabsTrigger>
                      <TabsTrigger value="review" className="rounded-lg text-xs px-3">
                        {reviewCount > 0 && <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />}
                        Review ({reviewCount})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </div>

              {/* Table */}
              <Card className="card-elevated border-0 overflow-hidden">
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Factor Match</TableHead>
                        <TableHead className="text-right">CO₂e / yr</TableHead>
                        <TableHead>Conf.</TableHead>
                        <TableHead>Region</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredActivities.slice(0, 200).map((act) => {
                        const est = estimates.find((e) => e.activityId === act.id);
                        const needsReview = est ? isReviewNeeded(est) : false;
                        const isExpanded = expandedId === act.id;
                        return (
                          <>
                            <TableRow
                              key={act.id}
                              className={cn(
                                "cursor-pointer hover:bg-muted/40 transition-colors",
                                needsReview && "border-l-2 border-l-amber-400",
                                isExpanded && "bg-muted/30",
                              )}
                              onClick={() => setExpandedId(isExpanded ? null : act.id)}
                            >
                              <TableCell className="text-muted-foreground/50 pl-3">
                                {isExpanded
                                  ? <ChevronDown className="h-3.5 w-3.5" />
                                  : <ChevronRight className="h-3.5 w-3.5" />}
                              </TableCell>
                              <TableCell className="max-w-[180px]">
                                <p className="text-sm font-medium truncate">{act.text}</p>
                                {act.note && (
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{act.note}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                {act.category ? (
                                  <span className={cn("text-[10px] rounded-full px-2 py-0.5 font-semibold", getCategoryStyle(act.category))}>
                                    {act.category.toUpperCase()}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/50">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <PhaseBadge phase={act.phase} category={act.category} />
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">
                                {act.quantity != null ? (
                                  `${act.quantity.toLocaleString()} ${act.unit ?? ""}`
                                ) : "—"}
                              </TableCell>
                              <TableCell className="max-w-[160px]">
                                {est ? (
                                  <p className="text-xs text-muted-foreground truncate">{est.matchedFactor.name}</p>
                                ) : mappingRunning ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/50">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-sm text-primary">
                                {est ? `${formatTonnes(est.co2eKg)} t`
                                  : mappingRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {est ? (
                                  <div className="flex items-center gap-1.5">
                                    <ConfidenceDot value={est.confidence} />
                                    {needsReview && (
                                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                    )}
                                  </div>
                                ) : <span className="text-[10px] text-muted-foreground/50">—</span>}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {act.region
                                  ? REGION_LABELS[act.region] ?? act.region.replace(/_/g, " ")
                                  : "—"}
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <ExpandedRow
                                key={`${act.id}-exp`}
                                act={act}
                                est={est}
                                allRegions={allRegions}
                                onUpdate={updateField}
                                onRemapNeeded={() => setRemapNeeded(true)}
                              />
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => navigate("/upload")} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              onClick={() => navigate("/benchmarking")}
              disabled={!bothDone}
              className="gap-2 rounded-xl"
            >
              Continue to Benchmarking <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────── */}
        <div className="w-64 shrink-0 hidden lg:block">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5 sticky top-8">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Summary
              </p>
              <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                LIVE
              </span>
            </div>

            {activities.length > 0 ? (
              <>
                <div>
                  <p className="text-4xl font-bold font-mono text-foreground">{activities.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Activities</p>
                </div>

                {estimates.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Avg Confidence</span>
                      <span className="font-mono font-semibold text-primary">{avgConfidence}%</span>
                    </div>
                    <Progress value={avgConfidence} className="h-1.5" />
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Embodied (Year 1)</span>
                      <span className="font-mono">{embodiedPct}%</span>
                    </div>
                    <Progress value={embodiedPct} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Operational (annual)</span>
                      <span className="font-mono">{operationalPct}%</span>
                    </div>
                    <Progress value={operationalPct} className="h-1.5" />
                  </div>
                </div>

                {estimates.length > 0 && (
                  <div className="pt-3 border-t border-border space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Total CO₂e / yr</span>
                    </div>
                    <p className="text-lg font-bold font-mono text-primary">
                      {formatTonnes(totalCo2e)} t
                    </p>
                    {reviewCount > 0 && (
                      <button
                        onClick={() => setQualityFilter("review")}
                        className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 hover:opacity-80 transition-opacity"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {reviewCount} need review
                      </button>
                    )}
                  </div>
                )}

                {dirty && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">Unsaved edits</p>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  {dirty && (
                    <Button
                      size="sm" className="w-full gap-1.5 rounded-xl" onClick={handleSave} disabled={saving}
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Changes
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={dirty ? "outline" : "default"}
                    onClick={() => navigate("/benchmarking")}
                    disabled={!bothDone}
                    className="w-full gap-1.5 rounded-xl"
                  >
                    Continue <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Waiting for extraction…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
