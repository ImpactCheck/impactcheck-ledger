import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { Report } from "@/contracts/impactcheck.v2";

interface Props {
  report: Report;
  hero?: boolean;
}

/** Derives missing-data signals from report: low-confidence hotspots, missing categories, etc. */
export function MissingDataSection({ report, hero }: Props) {
  // Derive evidence gaps from the available report data
  const primaryRegion = Object.keys(report.totalsByRegion)[0] ?? "";
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  const zeroCats = categories.filter((c) => c.co2eKg === 0);
  const regionCount = Object.keys(report.totalsByRegion).length;

  const gaps: string[] = [];
  if (zeroCats.length > 0) {
    gaps.push(`${zeroCats.length} categor${zeroCats.length === 1 ? "y has" : "ies have"} zero emissions — possible data gaps: ${zeroCats.map(c => c.category).join(", ")}`);
  }
  if (regionCount < 2) {
    gaps.push("Only one region assessed — consider adding comparison regions for broader coverage.");
  }
  if (report.hotspots.some((h) => !h.phase)) {
    gaps.push("Some hotspot activities lack phase classification (embodied/operational).");
  }
  if (gaps.length === 0) {
    gaps.push("No significant evidence gaps detected in the current dataset.");
  }

  return (
    <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${hero ? "text-xl" : "text-lg"}`}>
          <AlertTriangle className="h-4 w-4 text-warning" />
          Missing Data & Evidence Gaps
        </CardTitle>
        <CardDescription>Areas where additional data would improve audit quality per GHG Protocol completeness requirements.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {gaps.map((g, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-warning mt-0.5">•</span>
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
