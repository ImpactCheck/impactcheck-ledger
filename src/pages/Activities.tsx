import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Save, Download, Check, X, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { ExtractedActivity, UnitType } from "@/contracts/impactcheck.v2";
import { getActivityPhase } from "@/contracts/impactcheck.v2";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import JobProgressCard from "@/components/JobProgressCard";
import { useJobPoller } from "@/hooks/useJobPoller";
import { useStepCompletion } from "@/hooks/useStepCompletion";

const UNIT_TYPES: UnitType[] = [
  "Weight", "Energy", "Power", "Volume", "Area", "Distance", "Money", "Number",
  "Data", "Time", "WeightOverDistance", "ContainerOverDistance", "PassengerOverDistance",
  "AreaOverTime", "DataOverTime", "DistanceOverTime", "NumberOverTime", "WeightOverTime",
];

const REGION_LABELS: Record<string, string> = {
  texas_ercot: "Texas (ERCOT)",
  norway_hydro: "Norway (Hydro)",
  virginia_pjm: "Virginia (PJM)",
  iowa_miso: "Iowa (MISO)",
  iceland_geo: "Iceland (Geo)",
  singapore: "Singapore",
};

export default function Activities() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";
  const completion = useStepCompletion();

  const allRegions = [project.primaryRegion, ...project.comparisonRegions].filter(Boolean);
  const isMultiRegion = allRegions.length > 1;

  const [activities, setActivities] = useState<ExtractedActivity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const [activeRegionTab, setActiveRegionTab] = useState(allRegions[0] ?? "all");
  const [activePhaseTab, setActivePhaseTab] = useState<"all" | "embodied" | "operational">("all");

  const autoStartedRef = useRef(false);

  const load = useCallback(() => {
    api.getActivities(projectId).then((acts) => {
      setActivities(acts);
      setLoaded(true);
      setDirty(false);
    });
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const { job, start: startExtract, isRunning: extractRunning } = useJobPoller({
    projectId,
    jobType: "extract",
    onSuccess: load,
  });

  const handleExtract = useCallback(() => {
    startExtract(() => api.startExtract(projectId));
  }, [startExtract, projectId]);

  // Auto-start extraction on first load when: loaded, no activities, docs exist, no active job
  useEffect(() => {
    if (
      loaded &&
      !autoStartedRef.current &&
      !job &&
      !extractRunning &&
      activities.length === 0 &&
      completion.upload
    ) {
      autoStartedRef.current = true;
      handleExtract();
    }
  }, [loaded, job, extractRunning, activities.length, completion.upload, handleExtract]);

  const extractDone = job?.status === "succeeded";
  const extractFailed = job?.status === "failed";

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

  const handleExport = async () => {
    const csv = await api.exportCsv(projectId);
    setCsvPreview(csv);
  };

  const downloadCsv = () => {
    if (!csvPreview) return;
    const blob = new Blob([csvPreview], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activities_${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Phase counts
  const phaseCounts = useMemo(() => {
    const embodied = activities.filter((a) => getActivityPhase(a.category) === "embodied").length;
    return { embodied, operational: activities.length - embodied };
  }, [activities]);

  // Filter by region then phase
  const filtered = useMemo(() => {
    let result = activities;
    if (isMultiRegion && activeRegionTab !== "all") {
      result = result.filter((a) => a.region === activeRegionTab);
    }
    if (activePhaseTab !== "all") {
      result = result.filter((a) => getActivityPhase(a.category) === activePhaseTab);
    }
    return result;
  }, [activities, isMultiRegion, activeRegionTab, activePhaseTab]);

  const topCount = isMultiRegion ? 50 : 100;
  const displayActivities = filtered.slice(0, topCount);
  const hasActivities = activities.length > 0;

  // Determine if we're in an auto-started loading state (no activities yet, job running or not yet started)
  const isAutoLoading = loaded && !hasActivities && (extractRunning || (autoStartedRef.current && !job));

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="step-number mb-1">Step 3</p>
          <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            AI extracts carbon-relevant line items from your uploaded documents.
          </p>
        </div>
        {hasActivities && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 rounded-xl">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="gap-1.5 rounded-xl"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save edits
            </Button>
          </div>
        )}
      </div>

      {/* Extraction card */}
      <Card className="card-elevated border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Extraction
          </CardTitle>
          <CardDescription>
            {hasActivities
              ? `${activities.length} activities found — review and edit below.`
              : completion.upload
                ? "Analysing your documents for carbon-relevant activities…"
                : "Upload documents in the previous step to begin extraction."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-start notice */}
          {isAutoLoading && !job && (
            <div className="auto-start-banner flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary">Starting extraction automatically…</p>
                <p className="text-xs text-muted-foreground">We detected your uploaded documents — kicking off AI extraction</p>
              </div>
            </div>
          )}

          {job && <JobProgressCard job={job} type="extract" />}

          {extractFailed && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
              <X className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">Extraction failed. Please retry.</p>
            </div>
          )}

          {extractDone && !hasActivities && (
            <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3">
              <Check className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Extraction complete — no activities found in your documents.</p>
            </div>
          )}

          {/* Manual trigger / re-run — hidden during auto-loading */}
          {!extractRunning && loaded && !isAutoLoading && (
            <Button
              onClick={handleExtract}
              variant={hasActivities ? "outline" : "default"}
              className="gap-2 rounded-xl"
            >
              {hasActivities
                ? "Re-run Extraction"
                : extractFailed
                  ? "Retry Extraction"
                  : "Run Extraction"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Activity list */}
      {hasActivities && (
        <>
          {/* Phase summary + tabs */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {activities.length} total · {phaseCounts.embodied} embodied · {phaseCounts.operational} operational
              </span>
              <Badge variant="outline" className="text-xs rounded-full">
                {isMultiRegion ? `Top ${topCount} per region` : `Top ${topCount} selected`}
              </Badge>
            </div>

            <Tabs value={activePhaseTab} onValueChange={(v) => setActivePhaseTab(v as "all" | "embodied" | "operational")}>
              <TabsList className="rounded-xl">
                <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
                <TabsTrigger value="embodied" className="rounded-lg gap-1.5">
                  Embodied <span className="text-[10px] opacity-60">(One-time)</span>
                </TabsTrigger>
                <TabsTrigger value="operational" className="rounded-lg gap-1.5">
                  Operational <span className="text-[10px] opacity-60">(Annual)</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isMultiRegion ? (
            <Tabs value={activeRegionTab} onValueChange={setActiveRegionTab}>
              <TabsList className="rounded-xl">
                <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
                {allRegions.map((r) => (
                  <TabsTrigger key={r} value={r} className="rounded-lg">
                    {REGION_LABELS[r] ?? r.replace(/_/g, " ")}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={activeRegionTab} className="mt-4">
                <ActivityTable activities={displayActivities} allRegions={allRegions} onUpdate={updateField} />
              </TabsContent>
            </Tabs>
          ) : (
            <ActivityTable activities={displayActivities} allRegions={allRegions} onUpdate={updateField} />
          )}
        </>
      )}

      {/* CSV preview dialog */}
      <Dialog open={csvPreview !== null} onOpenChange={(open) => !open && setCsvPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>CSV Preview</DialogTitle>
            <DialogDescription>Preview of the exported CSV data.</DialogDescription>
          </DialogHeader>
          <pre className="flex-1 overflow-auto rounded-xl bg-muted p-4 text-xs font-mono whitespace-pre">
            {csvPreview}
          </pre>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCsvPreview(null)} className="rounded-xl">Close</Button>
            <Button size="sm" onClick={downloadCsv} className="gap-1.5 rounded-xl">
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/upload")} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => navigate("/mapping")} disabled={!hasActivities} className="gap-2 rounded-xl">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Editable Activity Table ──────────────────────────────────────────── */

const REGION_LABELS_MAP: Record<string, string> = {
  texas_ercot: "Texas (ERCOT)",
  norway_hydro: "Norway (Hydro)",
  virginia_pjm: "Virginia (PJM)",
  iowa_miso: "Iowa (MISO)",
  iceland_geo: "Iceland (Geo)",
  singapore: "Singapore",
};

function PhaseBadge({ category }: { category?: string }) {
  const phase = getActivityPhase(category);
  return phase === "embodied" ? (
    <Badge className="text-[10px] rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100">
      Embodied
    </Badge>
  ) : (
    <Badge className="text-[10px] rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-100">
      Operational
    </Badge>
  );
}

function ActivityTable({
  activities,
  allRegions,
  onUpdate,
}: {
  activities: ExtractedActivity[];
  allRegions: string[];
  onUpdate: (id: string, field: keyof ExtractedActivity, value: string | number | undefined) => void;
}) {
  return (
    <Card className="card-elevated border-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Activity Log</CardTitle>
        <CardDescription>{activities.length} activities shown.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {activities.map((act) => (
            <Collapsible key={act.id}>
              <div className="rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors border border-transparent hover:border-border/50">
                <div className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Textarea
                      value={act.text}
                      onChange={(e) => onUpdate(act.id, "text", e.target.value)}
                      className="min-h-[2.5rem] text-sm resize-none bg-card border-0 focus-visible:ring-1 flex-1"
                      rows={1}
                    />
                    <PhaseBadge category={act.category} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={act.unit_type ?? ""}
                      onValueChange={(v) => onUpdate(act.id, "unit_type", v || undefined)}
                    >
                      <SelectTrigger className="w-[130px] h-7 text-xs rounded-lg border-0 bg-card">
                        <SelectValue placeholder="Unit type" />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_TYPES.map((ut) => (
                          <SelectItem key={ut} value={ut} className="text-xs">{ut}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {allRegions.length > 0 && (
                      <Select
                        value={act.region ?? ""}
                        onValueChange={(v) => onUpdate(act.id, "region", v || undefined)}
                      >
                        <SelectTrigger className="w-[160px] h-7 text-xs rounded-lg border-0 bg-card">
                          <SelectValue placeholder="Region" />
                        </SelectTrigger>
                        <SelectContent>
                          {allRegions.map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">
                              {REGION_LABELS_MAP[r] ?? r.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {act.quantity != null && act.unit && (
                      <span className="text-xs text-muted-foreground font-mono bg-card rounded-lg px-2 py-1">
                        {act.quantity.toLocaleString()} {act.unit}
                      </span>
                    )}

                    {act.category && (
                      <span className="text-[10px] text-muted-foreground/70 font-mono bg-card rounded-lg px-2 py-1">
                        {act.category}
                      </span>
                    )}

                    <span className="ml-auto text-[10px] text-muted-foreground/50 font-mono">{act.id}</span>

                    {act.sourceDocumentId && (
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] rounded-lg">
                          Details
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                </div>
                {act.sourceDocumentId && (
                  <CollapsibleContent>
                    <div className="mx-3 mb-3 rounded-lg bg-card border border-border/60 p-3 text-xs text-muted-foreground space-y-1">
                      <p>
                        <span className="font-medium text-foreground">Source:</span>{" "}
                        {act.sourceDocumentId}
                      </p>
                      {act.note && (
                        <p>
                          <span className="font-medium text-foreground">Note:</span>{" "}
                          {act.note}
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                )}
              </div>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
