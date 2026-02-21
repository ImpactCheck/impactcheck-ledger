import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, Info, GitMerge } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { ActivityEstimate } from "@/contracts/impactcheck.v2";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStepCompletion } from "@/hooks/useStepCompletion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import JobProgressCard from "@/components/JobProgressCard";
import { useJobPoller } from "@/hooks/useJobPoller";

const REGION_LABELS: Record<string, string> = {
  texas_ercot: "Texas (ERCOT)",
  norway_hydro: "Norway (Hydro)",
  virginia_pjm: "Virginia (PJM)",
  iowa_miso: "Iowa (MISO)",
  iceland_geo: "Iceland (Geo)",
  singapore: "Singapore",
};

export default function Mapping() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";
  const completion = useStepCompletion();
  const canRunMapping = completion.setup && completion.upload && completion.activities;
  const allRegions = [project.primaryRegion, ...project.comparisonRegions].filter(Boolean);
  const isMultiRegion = allRegions.length > 1;

  const [estimates, setEstimates] = useState<ActivityEstimate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState(allRegions[0] ?? "all");

  const autoStartedRef = useRef(false);

  const loadEstimates = useCallback(() => {
    api.getEstimates(projectId).then((est) => {
      setEstimates(est);
      setLoaded(true);
    });
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

  // Auto-start mapping on first load when: loaded, no estimates, prerequisites met, no active job
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

  const filtered = isMultiRegion && activeTab !== "all"
    ? estimates.filter((e) => e.region === activeTab)
    : estimates;

  const isAutoLoading = loaded && !hasEstimates && (jobRunning || (autoStartedRef.current && !job));

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <p className="step-number mb-1">Step 4</p>
        <h1 className="text-2xl font-bold tracking-tight">Emission Mapping</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Match each activity to Climatiq emission factors and compute CO₂e estimates.
        </p>
      </div>

      <Card className="card-elevated border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-primary" />
            Climatiq Factor Mapping
          </CardTitle>
          <CardDescription>
            {hasEstimates
              ? `${estimates.length} factors matched — review results below.`
              : canRunMapping
                ? "Matching activities to emission factors via Climatiq…"
                : "Complete Setup, Upload, and Activities steps first."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canRunMapping && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Complete the previous steps (Setup, Upload, and Activities) before running mapping.
              </AlertDescription>
            </Alert>
          )}

          {/* Auto-start notice */}
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
              <p className="text-sm text-destructive">Mapping failed. Please retry.</p>
            </div>
          )}

          {/* Manual trigger / re-run */}
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
              <EstimatesTable estimates={filtered} />
            </TabsContent>
          </Tabs>
        ) : (
          <EstimatesTable estimates={filtered} />
        )
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/activities")} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => navigate("/report")} disabled={!hasEstimates} className="gap-2 rounded-xl">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EstimatesTable({ estimates }: { estimates: ActivityEstimate[] }) {
  return (
    <Card className="card-elevated border-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Estimates</CardTitle>
        <CardDescription>{estimates.length} matched factors</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activity</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Matched Factor</TableHead>
              <TableHead className="text-right">Confidence</TableHead>
              <TableHead className="text-right">CO₂e</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estimates.map((est) => (
              <TableRow key={`${est.activityId}-${est.region}`}>
                <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground font-mono">
                  {est.activityId}
                </TableCell>
                <TableCell className="text-xs">
                  {REGION_LABELS[est.region ?? ""] ?? est.region?.replace(/_/g, " ") ?? "—"}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{est.matchedFactor.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {est.matchedFactor.source} ({est.matchedFactor.year})
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Progress value={est.confidence * 100} className="h-1.5 w-16" />
                    <span className="text-xs font-mono w-8 text-right">
                      {(est.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-sm text-primary">
                  {formatTonnes(est.co2eKg)} t
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
