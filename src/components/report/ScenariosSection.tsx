import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingDown, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import type { Recommendation } from "@/contracts/impactcheck.v2";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  recommendations: Recommendation[];
  limit: number;
  hero?: boolean;
}

export function ScenariosSection({ recommendations, limit, hero }: Props) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? recommendations : recommendations.slice(0, limit);

  if (recommendations.length === 0) {
    return (
      <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
        <CardHeader>
          <CardTitle className={hero ? "text-xl" : "text-lg"}>Reduction Scenarios</CardTitle>
          <CardDescription>AI-generated strategies aligned with GHG Protocol guidance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm space-y-3">
            <p>No reduction scenarios generated yet.</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/recommendations")} className="gap-2 rounded-xl">
              Generate Scenarios <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={hero ? "text-xl" : "text-lg"}>Reduction Scenarios</CardTitle>
        <CardDescription>AI-generated strategies aligned with GHG Protocol guidance.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((rec) => (
            <div key={rec.id} className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 text-sm hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-3.5 w-3.5 text-primary shrink-0" />
                <div>
                  <span className="font-medium">{rec.title}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.summary}</p>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] text-primary rounded-full shrink-0 ml-3">
                -{formatTonnes(Math.abs(rec.expectedDeltaKg))} t
              </Badge>
            </div>
          ))}
        </div>
        {recommendations.length > limit && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="mt-3 text-xs">
            Show all {recommendations.length} scenarios
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
