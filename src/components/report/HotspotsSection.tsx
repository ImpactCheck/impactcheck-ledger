import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import type { Report } from "@/contracts/impactcheck.v2";
import { useState } from "react";

interface Props {
  report: Report;
  limit: number;
  hero?: boolean;
}

export function HotspotsSection({ report, limit, hero }: Props) {
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? report.hotspots : report.hotspots.slice(0, limit);

  return (
    <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${hero ? "text-xl" : "text-lg"}`}>
          <AlertTriangle className="h-4 w-4 text-warning" />
          Top Hotspots
        </CardTitle>
        <CardDescription>Highest-emission activities requiring attention.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((h, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 text-sm hover:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono w-5">{i + 1}.</span>
                <span className="font-medium">{h.text}</span>
                {h.phase && (
                  <Badge
                    className={`text-[10px] rounded-full ${
                      h.phase === "embodied"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        : "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                    }`}
                  >
                    {h.phase === "embodied" ? "Embodied" : "Operational"}
                  </Badge>
                )}
              </div>
              <span className="font-mono font-bold text-primary">{formatTonnes(h.co2eKg)} t</span>
            </div>
          ))}
        </div>
        {report.hotspots.length > limit && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="mt-3 text-xs">
            Show all {report.hotspots.length} hotspots
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
