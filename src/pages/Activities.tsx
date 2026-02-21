import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Save, Download, Check, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { ExtractedActivity, UnitType } from "@/contracts/impactcheck.v2";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import JobProgressCard from "@/components/JobProgressCard";
import { useJobPoller } from "@/hooks/useJobPoller";

const UNIT_TYPES: UnitType[] = ["Weight", "Energy", "Power", "Volume", "Area", "Distance", "Money", "Number", "Data", "Time", "WeightOverDistance", "ContainerOverDistance", "PassengerOverDistance", "AreaOverTime", "DataOverTime", "DistanceOverTime", "NumberOverTime", "WeightOverTime"];

export default function Activities() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";

  const allRegions = [project.primaryRegion, ...project.comparisonRegions].filter(Boolean);
  const isMultiRegion = allRegions.length > 1;

  const [activities, setActivities] = useState<ExtractedActivity[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const [activeRegionTab, setActiveRegionTab] = useState(allRegions[0] ?? "all");

  const load = useCallback(() => {
    api.getActivities(projectId).then((acts) => {
      setActivities(acts);
      setDirty(false);
    });
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const { job, start: startExtract, isRunning: extractRunning } = useJobPoller({
    projectId,
    jobType: "extract",
    onSuccess: load,
  });

  const handleExtract = () => startExtract(() => api.startExtract(projectId));
  const extractDone = job?.status === "succeeded";
  const extractFailed = job?.status === "failed";

  const updateField = (id: string, field: keyof ExtractedActivity, value: string | number | undefined) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
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

  const filtered = isMultiRegion && activeRegionTab !== "all"
    ? activities.filter((a) => a.region === activeRegionTab)
    : activities;

  const topCount = isMultiRegion ? 50 : 100;
  const displayActivities = filtered.slice(0, topCount);
  const hasActivities = activities.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Extract and review emission-producing activities from your documents.</p>
        </div>
        {hasActivities && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 rounded-xl">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="gap-1.5 rounded-xl">
              <Save className="h-3.5 w-3.5" /> Save edits
            </Button>
          </div>
        )}
      </div>

      {/* Extraction card */}
      <Card className="card-elevated border-0">
        <CardHeader>
          <CardTitle className="text-lg">Extract Activities</CardTitle>
          <CardDescription>Parse uploaded documents to extract carbon-relevant line items.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {job && <JobProgressCard job={job} type="extract" />}
          {!extractRunning && !extractDone && (
            <Button onClick={handleExtract} className="gap-2 rounded-xl" disabled={extractRunning}>
              {hasActivities ? "Re-run Extraction" : "Run Extraction"}
            </Button>
          )}
          {extractRunning && (
            <Button disabled className="gap-2 rounded-xl">
              <Loader2 className="h-4 w-4 animate-spin" /> Extracting…
            </Button>
          )}
          {extractDone && (
            <p className="text-sm text-muted-foreground">✓ Extraction completed — {activities.length} activities found.</p>
          )}
        </CardContent>
      </Card>

      {/* Activity list */}
      {hasActivities && (
        <>
          {/* Top N badge */}
          <div className="flex items-center gap-3">
            {isMultiRegion ? (
              <Badge variant="outline" className="text-xs rounded-full">Top {topCount} per region</Badge>
            ) : (
              <Badge variant="outline" className="text-xs rounded-full">Top {topCount} selected</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {activities.length} total activities · showing {displayActivities.length}
            </span>
          </div>

          {/* Multi-region tabs */}
          {isMultiRegion ? (
            <Tabs value={activeRegionTab} onValueChange={setActiveRegionTab}>
              <TabsList className="rounded-xl">
                <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
                {allRegions.map((r) => (
                  <TabsTrigger key={r} value={r} className="rounded-lg">{r.replace(/_/g, " ")}</TabsTrigger>
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
/* ─── Editable Activity Table ──────────────────────────────────────── */

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
        <CardTitle className="text-lg">Activity Log</CardTitle>
        <CardDescription>{activities.length} activities shown.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((act) => (
            <Collapsible key={act.id}>
              <div className="rounded-xl bg-muted/40 p-3 space-y-2 hover:bg-muted/60 transition-colors">
                <Textarea
                  value={act.text}
                  onChange={(e) => onUpdate(act.id, "text", e.target.value)}
                  className="min-h-[2.5rem] text-sm resize-none bg-card"
                  rows={1}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={act.unit_type ?? ""} onValueChange={(v) => onUpdate(act.id, "unit_type", v || undefined)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg"><SelectValue placeholder="Unit type" /></SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPES.map((ut) => <SelectItem key={ut} value={ut}>{ut}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {allRegions.length > 0 && (
                    <Select value={act.region ?? ""} onValueChange={(v) => onUpdate(act.id, "region", v || undefined)}>
                      <SelectTrigger className="w-[160px] h-8 text-xs rounded-lg"><SelectValue placeholder="Region" /></SelectTrigger>
                      <SelectContent>
                        {allRegions.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {act.quantity != null && act.unit && (
                    <span className="text-xs text-muted-foreground font-mono">{act.quantity.toLocaleString()} {act.unit}</span>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">{act.id}</span>
                  {act.sourceDocumentId && (
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] rounded-lg">Details</Button>
                    </CollapsibleTrigger>
                  )}
                </div>
                {act.sourceDocumentId && (
                  <CollapsibleContent>
                    <div className="rounded-lg bg-card p-2.5 text-xs text-muted-foreground space-y-1 mt-1">
                      <p><span className="font-medium text-foreground">Source:</span> {act.sourceDocumentId}</p>
                      {act.note && <p><span className="font-medium text-foreground">Note:</span> {act.note}</p>}
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
