import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, Check, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { ActivityEstimate, JobStatus } from "@/contracts/impactcheck.v2";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Mapping() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";

  const allRegions = [project.primaryRegion, ...project.comparisonRegions].filter(Boolean);
  const isMultiRegion = allRegions.length > 1;

  const [estimates, setEstimates] = useState<ActivityEstimate[]>([]);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeTab, setActiveTab] = useState(allRegions[0] ?? "all");

  // Try to load existing estimates on mount
  const loadEstimates = useCallback(() => {
    api.getEstimates(projectId).then((est) => {
      setEstimates(est);
      setLoaded(true);
    });
  }, [projectId]);

  useEffect(() => { loadEstimates(); }, [loadEstimates]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleMapping = async () => {
    const initial = await api.startMapping(projectId);
    setJob(initial);

    pollRef.current = setInterval(async () => {
      const status = await api.getJob(initial.id);
      setJob(status);
      if (status.status === "succeeded" || status.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        if (status.status === "succeeded") loadEstimates();
      }
    }, 1500);
  };

  const jobRunning = job?.status === "running" || job?.status === "queued";
  const jobDone = job?.status === "succeeded";
  const jobFailed = job?.status === "failed";
  const hasEstimates = estimates.length > 0;

  const filtered = isMultiRegion && activeTab !== "all"
    ? estimates.filter((e) => e.region === activeTab)
    : estimates;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Emission Mapping</h1>
        <p className="text-muted-foreground mt-1">Map activities to Climatiq emission factors.</p>
      </div>

      {/* Run mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Climatiq Factor Mapping</CardTitle>
          <CardDescription>Match each activity to emission factors and compute CO₂e estimates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {job && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{job.stage ?? "Waiting"}</span>
                <span className="font-mono text-xs">{job.progress}%</span>
              </div>
              <Progress value={job.progress} className="h-2" />
              {jobFailed && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> Mapping failed. Please retry.
                </div>
              )}
              {jobDone && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Check className="h-4 w-4" /> Mapping complete
                </div>
              )}
            </div>
          )}
          {!jobRunning && (
            <Button onClick={handleMapping} className="gap-2" disabled={jobRunning}>
              {hasEstimates ? "Re-run Mapping" : "Run Climatiq Mapping"}
            </Button>
          )}
          {jobRunning && (
            <Button disabled className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Mapping…
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Estimates table */}
      {hasEstimates && (
        isMultiRegion ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {allRegions.map((r) => (
                <TabsTrigger key={r} value={r}>{r.replace(/_/g, " ")}</TabsTrigger>
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

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/activities")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => navigate("/report")} disabled={!hasEstimates} className="gap-2">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EstimatesTable({ estimates }: { estimates: ActivityEstimate[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Estimates</CardTitle>
        <CardDescription>{estimates.length} matched factors.</CardDescription>
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
                <TableCell className="text-xs max-w-[200px] truncate">{est.activityId}</TableCell>
                <TableCell className="text-xs font-mono">{est.region?.replace(/_/g, " ") ?? "—"}</TableCell>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{est.matchedFactor.name}</p>
                    <p className="text-[10px] text-muted-foreground">{est.matchedFactor.source} ({est.matchedFactor.year})</p>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Progress value={est.confidence * 100} className="h-1.5 w-16" />
                    <span className="text-xs font-mono w-8 text-right">{(est.confidence * 100).toFixed(0)}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-sm">{formatTonnes(est.co2eKg)} t</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
