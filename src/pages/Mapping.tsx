import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/api";
import type { ActivityEstimate } from "@/contracts/impactcheck.v2";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { Progress } from "@/components/ui/progress";

export default function Mapping() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<ActivityEstimate[]>([]);

  useEffect(() => {
    api.getEstimates("prj_1").then(setEstimates);
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Emission Mapping</h1>
        <p className="text-muted-foreground mt-1">Activities mapped to emission factors with confidence scores.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Factor Mapping</CardTitle>
          <CardDescription>{estimates.length} activities matched to emission factors.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {estimates.map((est) => (
              <div key={est.activityId} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{est.matchedFactor.name}</p>
                    <p className="text-xs text-muted-foreground">{est.matchedFactor.source} ({est.matchedFactor.year})</p>
                  </div>
                  <span className="text-sm font-mono font-bold">{formatTonnes(est.co2eKg)} t</span>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={est.confidence * 100} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground font-mono">{(est.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/activities")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => navigate("/report")} className="gap-2">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
