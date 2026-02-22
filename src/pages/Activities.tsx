import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Save, Download, Check, X, Loader2, Sparkles, AlertTriangle } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
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

const CATEGORY_COLORS: Record<string, string> = {
  Compute: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Facility: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  Transport: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  Hardware: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

function getCategoryColor(cat?: string) {
  if (!cat) return "bg-muted text-muted-foreground";
  const key = Object.keys(CATEGORY_COLORS).find((k) => cat.toLowerCase().includes(k.toLowerCase()));
  return key ? CATEGORY_COLORS[key] : "bg-muted text-muted-foreground";
}

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

  const phaseCounts = useMemo(() => {
    const embodied = activities.filter((a) => getActivityPhase(a.category) === "embodied").length;
    return { embodied, operational: activities.length - embodied };
  }, [activities]);

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
  const isAutoLoading = loaded && !hasActivities && (extractRunning || (autoStartedRef.current && !job));

  const embodiedPct = activities.length > 0 ? Math.round((phaseCounts.embodied / activities.length) * 100) : 0;
  const operationalPct = 100 - embodiedPct;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="step-number mb-1">Step 03</p>
          <h1 className="text-2xl font-bold tracking-tight">Activity Review</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            AI extracts carbon-relevant line items from your uploaded documents.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {extractDone && hasActivities && (
            <span className="badge-ai">AI EXTRACTION COMPLETE</span>
          )}
          {hasActivities && (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Main panel ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
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

              {!extractRunning && loaded && !isAutoLoading && (
                <Button
                  onClick={handleExtract}
                  variant={hasActivities ? "outline" : "default"}
                  className="gap-2 rounded-xl"
                >
                  {hasActivities ? "Re-run Extraction" : extractFailed ? "Retry Extraction" : "Run Extraction"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Activity table */}
          {hasActivities && (
            <>
              <div className="flex flex-col gap-3">
                <Tabs value={activePhaseTab} onValueChange={(v) => setActivePhaseTab(v as "all" | "embodied" | "operational")}>
                  <TabsList className="rounded-xl">
                    <TabsTrigger value="all" className="rounded-lg">All ({activities.length})</TabsTrigger>
                    <TabsTrigger value="embodied" className="rounded-lg">Embodied / Year 1 ({phaseCounts.embodied})</TabsTrigger>
                    <TabsTrigger value="operational" className="rounded-lg">Operational / annual ({phaseCounts.operational})</TabsTrigger>
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

          {/* Navigation */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => navigate("/upload")} className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={() => navigate("/mapping")} disabled={!hasActivities} className="gap-2 rounded-xl">
              Continue to Mapping <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Right AI analysis panel ──────────────────────────────── */}
        <div className="w-64 shrink-0 hidden lg:block">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5 sticky top-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">AI Analysis Summary</p>
              {hasActivities ? (
                <>
                  <p className="text-4xl font-bold font-mono text-foreground">{activities.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Activities extracted</p>

                  <div className="mt-4 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Confidence</span>
                      <span className="font-mono font-semibold text-primary">92%</span>
                    </div>
                    <Progress value={92} className="h-1.5" />
                  </div>

                  <div className="mt-4 space-y-3">
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

                  {dirty && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning/10 border border-warning/20 p-3">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                      <p className="text-[11px] text-warning">Pending verification — unsaved edits</p>
                    </div>
                  )}

                  <Button
                    onClick={() => navigate("/mapping")}
                    disabled={!hasActivities}
                    size="sm"
                    className="w-full mt-4 gap-1.5 rounded-xl"
                  >
                    Continue to Mapping <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <div className="text-center py-6">
                  <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Waiting for extraction to complete…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}

/* ─── Activity Table ─────────────────────────────────────────────────── */

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
      EMBODIED
    </Badge>
  ) : (
    <Badge className="text-[10px] rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-100">
      OPERATIONAL
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
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
              <TableHead>Region</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((act) => (
              <>
                <TableRow
                  key={act.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => setExpandedId(expandedId === act.id ? null : act.id)}
                >
                  <TableCell className="text-[10px] text-muted-foreground/50 font-mono">
                    {expandedId === act.id ? "▾" : "▸"}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <p className="text-sm truncate font-medium">{act.text}</p>
                  </TableCell>
                  <TableCell>
                    {act.category && (
                      <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${getCategoryColor(act.category)}`}>
                        {act.category}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PhaseBadge category={act.category} />
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {act.quantity != null && act.unit ? `${act.quantity.toLocaleString()} ${act.unit}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {act.region ? (REGION_LABELS_MAP[act.region] ?? act.region.replace(/_/g, " ")) : "—"}
                  </TableCell>
                </TableRow>
                {expandedId === act.id && (
                  <TableRow key={`${act.id}-expanded`}>
                    <TableCell colSpan={6} className="bg-muted/20 p-4">
                      <Collapsible open>
                        <CollapsibleContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Description</label>
                              <Textarea
                                value={act.text}
                                onChange={(e) => onUpdate(act.id, "text", e.target.value)}
                                className="min-h-[2.5rem] text-sm resize-none"
                                rows={2}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Unit Type</label>
                                <Select
                                  value={act.unit_type ?? ""}
                                  onValueChange={(v) => onUpdate(act.id, "unit_type", v || undefined)}
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
                              {allRegions.length > 0 && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Region</label>
                                  <Select
                                    value={act.region ?? ""}
                                    onValueChange={(v) => onUpdate(act.id, "region", v || undefined)}
                                  >
                                    <SelectTrigger className="h-8 text-xs rounded-lg">
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
                                </div>
                              )}
                            </div>
                            {act.note && (
                              <div className="col-span-2">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Note</p>
                                <p className="text-xs text-muted-foreground">{act.note}</p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
