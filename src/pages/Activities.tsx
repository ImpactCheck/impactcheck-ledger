import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Activities() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
        <p className="text-muted-foreground mt-1">Define emission-producing activities across your infrastructure.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Log</CardTitle>
          <CardDescription>List key activities: compute, cooling, construction, transport.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Activity configuration coming soon. Continue to mapping.</p>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/upload")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={() => navigate("/mapping")} className="gap-2">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
