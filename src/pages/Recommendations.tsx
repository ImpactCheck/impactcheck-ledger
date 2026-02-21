import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/api";
import type { Recommendation } from "@/contracts/impactcheck.v2";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { useProject } from "@/contexts/ProjectContext";
import { Badge } from "@/components/ui/badge";

export default function Recommendations() {
  const navigate = useNavigate();
  const { project } = useProject();
  const showDeploy = project.companyType === "ai_infra";
  const [recs, setRecs] = useState<Recommendation[]>([]);

  useEffect(() => {
    api.generateRecommendations("prj_1").then(setRecs);
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recommendations</h1>
        <p className="text-muted-foreground mt-1">Actionable strategies to reduce your carbon footprint.</p>
      </div>

      {recs.map((rec) => (
        <Card key={rec.id} className="border-l-4 border-l-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-primary" />
                {rec.title}
              </CardTitle>
              <Badge variant="outline" className="font-mono text-primary border-primary/40 rounded-full">
                {formatTonnes(Math.abs(rec.expectedDeltaKg))} t reduction
              </Badge>
            </div>
            <CardDescription>{rec.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 p-3 text-sm font-mono">
              {rec.strategyDraftText}
            </div>
            {rec.constraints && rec.constraints.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Constraints: </span>
                {rec.constraints.join("; ")}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/report")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {showDeploy && (
          <Button onClick={() => navigate("/deploy")} className="gap-2">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
