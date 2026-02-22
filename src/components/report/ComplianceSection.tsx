import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import type { Report } from "@/contracts/impactcheck.v2";

interface Props {
  report: Report;
  hero?: boolean;
}

export function ComplianceSection({ report, hero }: Props) {
  return (
    <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={hero ? "text-xl" : "text-lg"}>Regulatory Compliance</CardTitle>
        <CardDescription>US and EU compliance assessment per GHG Protocol & CSRD standards.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl bg-muted/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ComplianceBadge level={report.compliance.us.status} />
              <span className="text-sm font-semibold">US (EPA)</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 ml-1">
              {report.compliance.us.reasons.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ComplianceBadge level={report.compliance.eu.status} />
              <span className="text-sm font-semibold">EU (CSRD)</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 ml-1">
              {report.compliance.eu.reasons.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
