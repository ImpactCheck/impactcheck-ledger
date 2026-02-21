import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatTonnes, formatNumber } from "@/contracts/impactcheck.v2";
import type { Report } from "@/contracts/impactcheck.v2";
import { FileText } from "lucide-react";
import { ComplianceBadge } from "./ComplianceBadge";

interface AuditCertificateProps {
  report: Report;
  projectName: string;
  primaryRegion: string;
}

export function AuditCertificate({ report, projectName, primaryRegion }: AuditCertificateProps) {
  const primaryTotal = report.totalsByRegion[primaryRegion] ?? 0;
  const usCompliance = report.compliance.us.status;
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2 glow-green">
          <FileText className="h-4 w-4" />
          Generate Audit Certificate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-3">
            <span className="text-gradient-green">ImpactCheck</span>
            <span className="text-muted-foreground font-normal text-sm">Audit Certificate</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Issue Date</p>
              <p className="font-mono text-sm">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <ComplianceBadge level={usCompliance} />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Project</p>
              <p className="text-lg font-bold">{projectName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Carbon (Primary Region)</p>
              <p className="text-2xl font-bold font-mono text-gradient-green">{formatTonnes(primaryTotal)} t</p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Category Breakdown</h4>
            <div className="grid grid-cols-2 gap-2 text-sm font-mono">
              {categories.map((c) => (
                <div key={c.category} className="flex justify-between">
                  <span className="text-muted-foreground">{c.category}</span>
                  <span>{formatTonnes(c.co2eKg)} t</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Compliance</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium mb-1">US (EPA)</p>
                <ComplianceBadge level={report.compliance.us.status} />
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  {report.compliance.us.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
              <div>
                <p className="font-medium mb-1">EU (CSRD)</p>
                <ComplianceBadge level={report.compliance.eu.status} />
                <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                  {report.compliance.eu.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            </div>
          </div>

          {report.deltaVsBaselineKg !== undefined && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delta vs. Baseline</p>
                <p className="text-lg font-bold font-mono">
                  {report.deltaVsBaselineKg > 0 ? "+" : ""}{formatTonnes(report.deltaVsBaselineKg)} t
                </p>
              </div>
            </>
          )}

          <Separator />

          <div className="text-center text-[10px] text-muted-foreground space-y-1">
            <p>This certificate is generated per the 2026 SCI for AI standard.</p>
            <p>ImpactCheck · AI Infrastructure Carbon Accounting Platform</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
