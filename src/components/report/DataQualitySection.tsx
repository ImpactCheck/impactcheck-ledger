import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Report } from "@/contracts/impactcheck.v2";

interface Props {
  report: Report;
  hero?: boolean;
}

/** Shows data quality / confidence / coverage derived from report data. */
export function DataQualitySection({ report, hero }: Props) {
  const primaryRegion = Object.keys(report.totalsByRegion)[0] ?? "";
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  const totalCategories = categories.length;
  const nonZeroCategories = categories.filter((c) => c.co2eKg > 0).length;
  const coverage = totalCategories > 0 ? Math.round((nonZeroCategories / totalCategories) * 100) : 0;

  const hotspotsWithPhase = report.hotspots.filter((h) => h.phase).length;
  const phaseClassification = report.hotspots.length > 0
    ? Math.round((hotspotsWithPhase / report.hotspots.length) * 100)
    : 100;

  return (
    <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={hero ? "text-xl" : "text-lg"}>Data Quality & Confidence</CardTitle>
        <CardDescription>Assessment coverage and classification completeness per GHG Protocol data quality criteria.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Category Coverage</span>
            <span className="font-mono font-bold">{coverage}%</span>
          </div>
          <Progress value={coverage} className="h-2" />
          <p className="text-[11px] text-muted-foreground mt-1">{nonZeroCategories} of {totalCategories} categories have emission data</p>
        </div>
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Phase Classification</span>
            <span className="font-mono font-bold">{phaseClassification}%</span>
          </div>
          <Progress value={phaseClassification} className="h-2" />
          <p className="text-[11px] text-muted-foreground mt-1">{hotspotsWithPhase} of {report.hotspots.length} activities classified as embodied (Year 1) or operational (annual)</p>
        </div>
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Regional Breadth</span>
            <span className="font-mono font-bold">{Object.keys(report.totalsByRegion).length} region(s)</span>
          </div>
          <Progress value={Math.min(Object.keys(report.totalsByRegion).length * 33, 100)} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
