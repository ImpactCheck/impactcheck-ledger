import { Card, CardContent } from "@/components/ui/card";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import { Building2, Zap } from "lucide-react";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import type { Report } from "@/contracts/impactcheck.v2";

const EMBODIED_COLOR = "hsl(30 80% 55%)";
const OPERATIONAL_COLOR = "hsl(200 70% 50%)";

interface Props {
  report: Report;
  primaryRegion: string;
  hero?: boolean;
}

export function ExecutiveSummarySection({ report, primaryRegion, hero }: Props) {
  const primaryTotal = report.totalsByRegion[primaryRegion] ?? 0;
  const phaseTotals = report.phaseTotalsByRegion?.[primaryRegion] ?? { embodied: 0, operational: 0 };

  return (
    <div className="space-y-4">
      <Card className={`card-elevated border-0 overflow-hidden print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
        <div className="bg-gradient-green p-6 text-primary-foreground">
          <p className="text-xs uppercase tracking-wider opacity-80">Total Lifecycle Carbon — {primaryRegion.replace(/_/g, " ")}</p>
          <p className={`font-bold font-mono mt-2 ${hero ? "text-5xl" : "text-4xl"}`}>
            {formatTonnes(primaryTotal)} <span className="text-lg font-normal opacity-70">tonnes CO₂e</span>
          </p>
          {report.deltaVsBaselineKg !== undefined && (
            <p className="text-sm mt-1.5 opacity-80">
              {report.deltaVsBaselineKg > 0 ? "+" : ""}{formatTonnes(report.deltaVsBaselineKg)} t vs. baseline
            </p>
          )}
        </div>
        <CardContent className="pt-4 pb-4 flex gap-3">
          <ComplianceBadge level={report.compliance.us.status} />
          <ComplianceBadge level={report.compliance.eu.status} />
        </CardContent>
      </Card>

      {/* Embodied vs Operational split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="card-elevated border-0 print:border print:shadow-none">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(30 80% 55% / 0.15)" }}>
                <Building2 className="h-5 w-5" style={{ color: EMBODIED_COLOR }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Embodied Carbon</p>
                <p className="text-2xl font-bold font-mono">
                  {formatTonnes(phaseTotals.embodied)} <span className="text-sm font-normal text-muted-foreground">t CO₂e</span>
                </p>
                <p className="text-[11px] text-muted-foreground">Year 1 only · construction & hardware (no embodied in later years)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated border-0 print:border print:shadow-none">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(200 70% 50% / 0.15)" }}>
                <Zap className="h-5 w-5" style={{ color: OPERATIONAL_COLOR }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Operational Carbon</p>
                <p className="text-2xl font-bold font-mono">
                  {formatTonnes(phaseTotals.operational)} <span className="text-sm font-normal text-muted-foreground">t CO₂e</span>
                </p>
                <p className="text-[11px] text-muted-foreground">Per year · energy & operations (recurring every year)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
