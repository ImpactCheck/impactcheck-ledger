import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket, Terminal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/api";
import type { DeploymentPlan } from "@/contracts/impactcheck.v2";
import { Badge } from "@/components/ui/badge";

export default function Deploy() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<DeploymentPlan | null>(null);

  useEffect(() => {
    api.getDeploymentStatus("prj_1").then(setPlan);
  }, []);

  const statusColor = {
    not_started: "text-muted-foreground",
    running: "text-warning",
    succeeded: "text-primary",
    failed: "text-destructive",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deploy Audit</h1>
        <p className="text-muted-foreground mt-1">Publish your carbon audit certificate for stakeholders.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Deploy & Share</CardTitle>
            {plan && (
              <Badge variant="outline" className={statusColor[plan.status]}>
                {plan.status.replace("_", " ")}
              </Badge>
            )}
          </div>
          <CardDescription>Generate and distribute your SCI audit certificate.</CardDescription>
        </CardHeader>
        <CardContent>
          {plan ? (
            <div className="space-y-3">
              <div className="rounded-md bg-secondary/30 p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
                {plan.logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Terminal className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                    <span className="text-muted-foreground">{log}</span>
                  </div>
                ))}
              </div>
              {plan.status !== "running" && (
                <Button
                  className="gap-2 glow-green"
                  onClick={() => api.deployCrusoe("prj_1").then(setPlan)}
                >
                  <Rocket className="h-4 w-4" />
                  {plan.status === "succeeded" ? "Re-deploy" : "Deploy Now"}
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Rocket className="h-12 w-12 mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">Loading deployment status…</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button variant="outline" onClick={() => navigate("/recommendations")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    </div>
  );
}
