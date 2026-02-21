import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket, Terminal, Loader2, Check, ShieldAlert } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { api } from "@/api";
import { useProject } from "@/contexts/ProjectContext";
import type { DeploymentPlan } from "@/contracts/impactcheck.v2";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  not_started: { label: "Not Started", className: "text-muted-foreground border-border" },
  running: { label: "Running", className: "text-warning border-warning/30" },
  succeeded: { label: "Succeeded", className: "text-primary border-primary/30" },
  failed: { label: "Failed", className: "text-destructive border-destructive/30" },
};

export default function Deploy() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";

  const [plan, setPlan] = useState<DeploymentPlan | null>(null);
  const [deploying, setDeploying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!project.deployOptIn) {
    return <Navigate to="/recommendations" replace />;
  }

  const handleDeploy = async () => {
    setDeploying(true);
    const initial = await api.deployCrusoe(projectId);
    setPlan(initial);
    pollRef.current = setInterval(async () => {
      const status = await api.getDeploymentStatus(projectId);
      setPlan(status);
      scrollToBottom();
      if (status.status === "succeeded" || status.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setDeploying(false);
      }
    }, 1500);
  };

  const status = plan?.status ?? "not_started";
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deploy via Crusoe</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Publish your carbon audit and deploy to Crusoe Cloud infrastructure.</p>
      </div>

      <Card className="card-elevated border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              Deployment
            </CardTitle>
            <Badge variant="outline" className={cn("font-mono text-xs rounded-full", cfg.className)}>
              {cfg.label}
            </Badge>
          </div>
          <CardDescription>Deploy your finalized strategy and audit certificate to Crusoe Cloud.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan && plan.logs.length > 0 && (
            <div className="rounded-xl bg-foreground/[0.03] dark:bg-background border p-4 font-mono text-xs space-y-1.5 max-h-64 overflow-y-auto">
              {plan.logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 animate-in fade-in duration-300">
                  <Terminal className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                  <span className={cn(
                    "text-muted-foreground",
                    i === plan.logs.length - 1 && status === "running" && "text-foreground"
                  )}>
                    {log}
                  </span>
                </div>
              ))}
              {status === "running" && (
                <div className="flex items-center gap-2 text-warning">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Processing…</span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          )}

          {status === "succeeded" && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-primary font-medium">
              <Check className="h-4 w-4" />
              Deployment succeeded — audit certificate is live.
            </div>
          )}

          {status === "failed" && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4" />
              Deployment failed. Please retry.
            </div>
          )}

          {!deploying && (
            <Button onClick={handleDeploy} className="gap-2 rounded-xl">
              <Rocket className="h-4 w-4" />
              {status === "succeeded" ? "Re-deploy" : status === "failed" ? "Retry Deploy" : "Deploy via Crusoe"}
            </Button>
          )}
          {deploying && (
            <Button disabled className="gap-2 rounded-xl">
              <Loader2 className="h-4 w-4 animate-spin" /> Deploying…
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button variant="outline" onClick={() => navigate("/recommendations")} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    </div>
  );
}
