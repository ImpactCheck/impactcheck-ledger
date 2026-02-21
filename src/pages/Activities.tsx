import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/api";
import type { ExtractedActivity } from "@/contracts/impactcheck.v2";
import { Badge } from "@/components/ui/badge";

export default function Activities() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ExtractedActivity[]>([]);

  useEffect(() => {
    api.getActivities("prj_1").then(setActivities);
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
        <p className="text-muted-foreground mt-1">Extracted emission-producing activities across your infrastructure.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Log</CardTitle>
          <CardDescription>{activities.length} activities extracted from uploaded documents.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {activities.map((act) => (
              <div key={act.id} className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm">
                <div className="flex-1">
                  <p className="font-medium">{act.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {act.unit_type && (
                      <Badge variant="outline" className="text-[10px]">{act.unit_type}</Badge>
                    )}
                    {act.quantity != null && act.unit && (
                      <span className="text-xs text-muted-foreground font-mono">{act.quantity.toLocaleString()} {act.unit}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{act.id}</span>
              </div>
            ))}
          </div>
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
