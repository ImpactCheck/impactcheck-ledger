import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import type { Report, RegionComplianceResult, JurisdictionCompliance } from "@/contracts/impactcheck.v2";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { useState } from "react";

interface Props {
  report: Report;
  hero?: boolean;
}

function jurisdictionStatus(j: JurisdictionCompliance | undefined): "green" | "yellow" | "red" {
  if (!j?.checks) return "yellow";
  const statuses = Object.values(j.checks).map((c) => c.status);
  const hasFail = statuses.includes("FAIL");
  const hasMissing = statuses.includes("MISSING");
  if (hasFail) return "red";
  if (hasMissing) return "yellow";
  return "green";
}

function RegionComplianceCard({
  regionKey,
  result,
  totalCo2eKg,
}: {
  regionKey: string;
  result: RegionComplianceResult;
  totalCo2eKg?: number;
}) {
  const [open, setOpen] = useState(false);
  const regionLabel = regionKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (result.error) {
    return (
      <div className="rounded-xl bg-muted/40 p-4 border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold">{regionLabel}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{result.error}</p>
      </div>
    );
  }

  const jurisdictions = result.jurisdictions || {};
  const primary = result.primary_jurisdiction;
  const primaryData = jurisdictions[primary];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl bg-muted/40 p-4 border border-border">
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
          <div className="flex items-center gap-2">
            <ChevronRight
              className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
            />
            <span className="text-sm font-semibold">{regionLabel}</span>
            <Badge variant="outline" className="text-[10px]">
              {primary}
            </Badge>
            {totalCo2eKg !== undefined && (
              <span className="text-xs text-muted-foreground font-mono">
                {totalCo2eKg >= 1e6
                  ? `${(totalCo2eKg / 1e6).toFixed(1)}M`
                  : totalCo2eKg >= 1e3
                    ? `${(totalCo2eKg / 1e3).toFixed(1)}K`
                    : totalCo2eKg.toFixed(0)}{" "}
                kg CO₂e
              </span>
            )}
          </div>
          {primaryData && (
            <ComplianceBadge level={jurisdictionStatus(primaryData)} />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-4 space-y-4 pt-2 border-t border-border">
            {Object.entries(jurisdictions).map(([jurName, jur]) => {
              if (jur.evaluation_status === "NOT_EVALUATED") return null;
              const status = jurisdictionStatus(jur);
              const checks = jur.checks || {};
              const checkEntries = Object.entries(checks);
              if (checkEntries.length === 0) return null;

              return (
                <div key={jurName} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{jurName}</span>
                    <ComplianceBadge level={status} />
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                    {checkEntries.slice(0, 5).map(([checkName, check]) => (
                      <li key={checkName} className="flex items-center gap-2">
                        <span
                          className={
                            check.status === "PASS"
                              ? "text-green-600 dark:text-green-400"
                              : check.status === "FAIL"
                                ? "text-red-600 dark:text-red-400"
                                : "text-amber-600 dark:text-amber-400"
                          }
                        >
                          {check.status}
                        </span>
                        <span className="truncate">{checkName}</span>
                      </li>
                    ))}
                    {checkEntries.length > 5 && (
                      <li className="text-muted-foreground/70">
                        +{checkEntries.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function ComplianceSection({ report, hero }: Props) {
  const byRegion = report.compliance.byRegion || {};
  const hasByRegion = Object.keys(byRegion).length > 0;

  return (
    <Card
      className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}
    >
      <CardHeader>
        <CardTitle className={hero ? "text-xl" : "text-lg"}>
          Regulatory Compliance
        </CardTitle>
        <CardDescription>
          Compliance assessment for Norway, EU, USA, and Iceland per regional
          regulation checklists. Evaluated for home region and each comparison
          region.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasByRegion ? (
          <div className="space-y-4">
            {Object.entries(byRegion).map(([regionKey, result]) => (
              <RegionComplianceCard
                key={regionKey}
                regionKey={regionKey}
                result={result}
                totalCo2eKg={result.totalCo2eKg}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ComplianceBadge level={report.compliance.us.status} />
                <span className="text-sm font-semibold">US (EPA)</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 ml-1">
                {report.compliance.us.reasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ComplianceBadge level={report.compliance.eu.status} />
                <span className="text-sm font-semibold">EU (CSRD)</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 ml-1">
                {report.compliance.eu.reasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
