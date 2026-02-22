import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSearch } from "lucide-react";
import type { Report } from "@/contracts/impactcheck.v2";

interface Props {
  report: Report;
  hero?: boolean;
}

/** Shows traceability: sources, factor metadata, and methodology references. */
export function TraceabilitySection({ report, hero }: Props) {
  const regionCount = Object.keys(report.totalsByRegion).length;
  const primaryRegion = Object.keys(report.totalsByRegion)[0] ?? "";
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];

  return (
    <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${hero ? "text-xl" : "text-lg"}`}>
          <FileSearch className="h-4 w-4 text-primary" />
          Traceability & Factor Metadata
        </CardTitle>
        <CardDescription>Emission factor sources and methodology provenance per GHG Protocol transparency requirements.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
          <p><span className="font-medium">Methodology:</span> GHG Protocol Corporate Standard, ISO 14064-1</p>
          <p><span className="font-medium">Emission Factor Sources:</span> Climatiq API (aggregated from DEFRA, EPA, ecoinvent, ADEME)</p>
          <p><span className="font-medium">Regions Assessed:</span> {Object.keys(report.totalsByRegion).map(r => r.replace(/_/g, " ")).join(", ")}</p>
          <p><span className="font-medium">Categories Mapped:</span> {categories.length} categories across {regionCount} region(s)</p>
          <p><span className="font-medium">Compliance Frameworks:</span> US EPA, EU CSRD / ESRS E1</p>
        </div>
        <p className="text-xs text-muted-foreground">
          All emission factors are sourced through the Climatiq API and traceable to their original databases.
          Factor selection follows a best-match algorithm based on activity description, unit type, and region.
        </p>
      </CardContent>
    </Card>
  );
}
