import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Deploy() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deploy Audit</h1>
        <p className="text-muted-foreground mt-1">Publish your carbon audit certificate for stakeholders.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deploy & Share</CardTitle>
          <CardDescription>Generate and distribute your SCI audit certificate.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Rocket className="h-12 w-12 mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Deployment pipeline coming soon.</p>
          </div>
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
