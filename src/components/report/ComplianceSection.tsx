import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import type { Report, RegionComplianceResult, RegionComplianceByPeriod, JurisdictionCompliance } from "@/contracts/impactcheck.v2";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, AlertCircle, Calendar, CalendarClock, MapPin, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  report: Report;
  hero?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

function jurisdictionStatus(j: JurisdictionCompliance | undefined): "green" | "yellow" | "red" {
  if (!j?.checks) return "yellow";
  const statuses = Object.values(j.checks).map((c) => c.status);
  if (statuses.includes("FAIL")) return "red";
  if (statuses.includes("MISSING")) return "yellow";
  return "green";
}

function overallStatus(result: RegionComplianceResult | undefined): "green" | "yellow" | "red" {
  if (!result || result.error) return "yellow";
  const jurisdictions = result.jurisdictions || {};
  const primary = result.primary_jurisdiction;
  const primaryData = jurisdictions[primary];
  return jurisdictionStatus(primaryData);
}

function statusLabel(s: "green" | "yellow" | "red"): string {
  if (s === "green") return "Compliant";
  if (s === "red") return "Non-Compliant";
  return "Incomplete Data";
}

function PeriodComplianceDetail({
  result,
  label,
}: {
  result: RegionComplianceResult;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  if (result.error) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
        <span>{label}: {result.error}</span>
      </div>
    );
  }

  const jurisdictions = result.jurisdictions || {};
  const primary = result.primary_jurisdiction;
  const primaryData = jurisdictions[primary];
  const status = jurisdictionStatus(primaryData);
  const checks = primaryData?.checks || {};
  const checkEntries = Object.entries(checks);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="text-xs font-medium">{label}</span>
        <ComplianceBadge level={status} />
        <span className="text-[10px] text-muted-foreground ml-auto">{statusLabel(status)}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-5 space-y-2">
          {Object.entries(jurisdictions).map(([jurName, jur]) => {
            if (jur.evaluation_status === "NOT_EVALUATED") return null;
            const jurChecks = jur.checks || {};
            const jurCheckEntries = Object.entries(jurChecks);
            if (jurCheckEntries.length === 0) return null;
            return (
              <div key={jurName} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{jurName}</span>
                  <ComplianceBadge level={jurisdictionStatus(jur)} />
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 ml-2">
                  {jurCheckEntries.map(([checkName, check]) => (
                    <li key={checkName} className="flex items-start gap-1.5">
                      <span
                        className={`shrink-0 font-mono text-[10px] ${
                          check.status === "PASS"
                            ? "text-green-600 dark:text-green-400"
                            : check.status === "FAIL"
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {check.status === "PASS" ? "✓" : check.status === "FAIL" ? "✗" : "?"}
                      </span>
                      <span className="leading-tight">{checkName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RegionComplianceCard({
  regionKey,
  data,
  isPrimary,
}: {
  regionKey: string;
  data: RegionComplianceByPeriod;
  isPrimary: boolean;
}) {
  const regionLabel = regionKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const year1Status = overallStatus(data.year1);
  const ongoingStatus = overallStatus(data.ongoing);

  // Overall region status: worst of both periods
  const worstStatus = year1Status === "red" || ongoingStatus === "red"
    ? "red"
    : year1Status === "yellow" || ongoingStatus === "yellow"
      ? "yellow"
      : "green";

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      isPrimary ? "bg-card border-primary/20" : "bg-muted/40 border-border"
    }`}>
      {/* Region header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{regionLabel}</span>
          {isPrimary && (
            <Badge variant="default" className="text-[10px] rounded-full">Home</Badge>
          )}
          {data.year1?.primary_jurisdiction && (
            <Badge variant="outline" className="text-[10px]">
              {data.year1.primary_jurisdiction}
            </Badge>
          )}
        </div>
        <ComplianceBadge level={worstStatus} />
      </div>

      {/* Year 1 vs Following Years summary row */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg p-3 border ${
          year1Status === "green" ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" :
          year1Status === "red" ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" :
          "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
        }`}>
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Year 1</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ComplianceBadge level={year1Status} />
            <span className="text-[10px] text-muted-foreground">{statusLabel(year1Status)}</span>
          </div>
          {data.year1?.totalCo2eKg !== undefined && (
            <span className="text-[10px] text-muted-foreground font-mono mt-1 block">
              {data.year1.totalCo2eKg >= 1e6
                ? `${(data.year1.totalCo2eKg / 1e6).toFixed(1)}M`
                : data.year1.totalCo2eKg >= 1e3
                  ? `${(data.year1.totalCo2eKg / 1e3).toFixed(1)}K`
                  : data.year1.totalCo2eKg.toFixed(0)} kg CO₂e
            </span>
          )}
        </div>
        <div className={`rounded-lg p-3 border ${
          ongoingStatus === "green" ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" :
          ongoingStatus === "red" ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" :
          "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
        }`}>
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarClock className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Following Years</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ComplianceBadge level={ongoingStatus} />
            <span className="text-[10px] text-muted-foreground">{statusLabel(ongoingStatus)}</span>
          </div>
          {data.ongoing?.totalCo2eKg !== undefined && (
            <span className="text-[10px] text-muted-foreground font-mono mt-1 block">
              {data.ongoing.totalCo2eKg >= 1e6
                ? `${(data.ongoing.totalCo2eKg / 1e6).toFixed(1)}M`
                : data.ongoing.totalCo2eKg >= 1e3
                  ? `${(data.ongoing.totalCo2eKg / 1e3).toFixed(1)}K`
                  : data.ongoing.totalCo2eKg.toFixed(0)} kg CO₂e
            </span>
          )}
        </div>
      </div>

      {/* Expandable check details */}
      <div className="space-y-1 pt-1 border-t border-border">
        {data.year1 && !data.year1.error && (
          <PeriodComplianceDetail result={data.year1} label="Year 1 Details" />
        )}
        {data.ongoing && !data.ongoing.error && (
          <PeriodComplianceDetail result={data.ongoing} label="Following Years Details" />
        )}
      </div>
    </div>
  );
}

export function ComplianceSection({ report, hero, onRefresh, refreshing }: Props) {
  const byRegion = report.compliance.byRegion || {};
  const hasByRegion = Object.keys(byRegion).length > 0;

  return (
    <Card
      className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className={hero ? "text-xl" : "text-lg"}>
              Regulatory Compliance
            </CardTitle>
            <CardDescription>
          Compliance assessed for all locations across Year 1 (includes embodied emissions) and Following Years (operational only).
          It is possible to be non-compliant in Year 1 but compliant in subsequent years due to one-time construction/hardware emissions.
        </CardDescription>
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="shrink-0 print:hidden"
              title="Re-run compliance evaluation (e.g. after updating activities)"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasByRegion ? (
          <div className="space-y-4">
            {Object.entries(byRegion).map(([regionKey, data], idx) => (
              <RegionComplianceCard
                key={regionKey}
                regionKey={regionKey}
                data={data}
                isPrimary={idx === 0}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading compliance evaluation…</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
