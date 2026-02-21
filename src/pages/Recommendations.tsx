import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";

export default function Recommendations() {
  const navigate = useNavigate();
  const { project } = useProject();
  const showDeploy = project.companyType === "ai_infra";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recommendations</h1>
        <p className="text-muted-foreground mt-1">AI-powered suggestions to reduce your carbon footprint.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Optimization Tips</CardTitle>
          <CardDescription>Actionable steps ranked by impact.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Recommendation engine coming soon.</p>
        </CardContent>
      </Card>

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
