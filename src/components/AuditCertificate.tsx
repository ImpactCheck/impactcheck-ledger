import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatTonnes, formatNumber } from "@/contracts/impactcheck.v2";
import type { Report } from "@/contracts/impactcheck.v2";
import { FileText, Download } from "lucide-react";
import { ComplianceBadge } from "./ComplianceBadge";
import { useRef, useCallback } from "react";

interface AuditCertificateProps {
  report: Report;
  projectName: string;
  primaryRegion: string;
}

function generateCertificateHTML(report: Report, projectName: string, primaryRegion: string): string {
  const primaryTotal = report.totalsByRegion[primaryRegion] ?? 0;
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const complianceLabel = (status: string) =>
    status === "green" ? "✅ Compliant" : status === "yellow" ? "⚠️ Partial" : "❌ Non-compliant";

  const categoryRows = categories
    .map(
      (c) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${c.category}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${formatTonnes(c.co2eKg)} t CO₂e</td></tr>`
    )
    .join("");

  const regionRows = Object.entries(report.totalsByRegion)
    .map(
      ([region, total]) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${region.replace(/_/g, " ")}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${formatTonnes(total)} t CO₂e</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>ImpactCheck Audit Certificate - ${projectName}</title>
<style>
  @page { size: A4; margin: 40px 50px; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; line-height: 1.6; margin: 0; padding: 40px 50px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0cb37d; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 24px; font-weight: 800; color: #0cb37d; }
  .subtitle { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }
  .date { font-size: 12px; color: #6b7280; text-align: right; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #0cb37d; margin-top: 28px; margin-bottom: 10px; }
  .big-number { font-size: 32px; font-weight: 800; font-family: monospace; color: #0cb37d; }
  .metric-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; background: #f3f4f6; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  .compliance-box { padding: 12px 16px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; margin-bottom: 8px; }
  .compliance-box.warn { background: #fffbeb; border-color: #fde68a; }
  .compliance-box.fail { background: #fef2f2; border-color: #fecaca; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
  .ghg-badge { display: inline-block; padding: 4px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; font-size: 10px; font-weight: 600; color: #16a34a; letter-spacing: 0.5px; }
  .two-col { display: flex; gap: 24px; }
  .two-col > div { flex: 1; }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="logo">ImpactCheck</div>
      <div class="subtitle">GHG Protocol Audit Certificate</div>
    </div>
    <div class="date">
      <div>Issue Date: ${dateStr}</div>
      <div style="margin-top:6px;"><span class="ghg-badge">GHG Protocol Aligned</span></div>
    </div>
  </div>

  <div class="section-title">Project Summary</div>
  <div class="two-col">
    <div>
      <div class="metric-label">Project Name</div>
      <div style="font-size:18px;font-weight:700;">${projectName}</div>
    </div>
    <div>
      <div class="metric-label">Total Carbon Emissions (Primary Region)</div>
      <div class="big-number">${formatTonnes(primaryTotal)} t CO₂e</div>
    </div>
  </div>

  ${Object.keys(report.totalsByRegion).length > 1 ? `
  <div class="section-title">Regional Totals</div>
  <table><thead><tr><th>Region</th><th style="text-align:right;">Total</th></tr></thead><tbody>${regionRows}</tbody></table>
  ` : ""}

  <div class="section-title">Category Breakdown — ${primaryRegion.replace(/_/g, " ")}</div>
  <table><thead><tr><th>Category</th><th style="text-align:right;">Emissions</th></tr></thead><tbody>${categoryRows}</tbody></table>

  ${report.deltaVsBaselineKg !== undefined ? `
  <div class="section-title">Delta vs. Baseline</div>
  <div style="font-size:20px;font-weight:700;font-family:monospace;">${report.deltaVsBaselineKg > 0 ? "+" : ""}${formatTonnes(report.deltaVsBaselineKg)} t CO₂e</div>
  ` : ""}

  <div class="section-title">Compliance Assessment</div>
  <div class="two-col">
    <div class="compliance-box${report.compliance.us.status === "yellow" ? " warn" : report.compliance.us.status === "red" ? " fail" : ""}">
      <div style="font-weight:700;margin-bottom:4px;">US (EPA) — ${complianceLabel(report.compliance.us.status)}</div>
      <ul style="margin:0;padding-left:16px;font-size:12px;color:#4b5563;">
        ${report.compliance.us.reasons.map((r) => `<li>${r}</li>`).join("")}
      </ul>
    </div>
    <div class="compliance-box${report.compliance.eu.status === "yellow" ? " warn" : report.compliance.eu.status === "red" ? " fail" : ""}">
      <div style="font-weight:700;margin-bottom:4px;">EU (CSRD) — ${complianceLabel(report.compliance.eu.status)}</div>
      <ul style="margin:0;padding-left:16px;font-size:12px;color:#4b5563;">
        ${report.compliance.eu.reasons.map((r) => `<li>${r}</li>`).join("")}
      </ul>
    </div>
  </div>

  <div class="section-title">Methodology</div>
  <table>
    <tbody>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">Standard</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">GHG Protocol Corporate Standard (Scope 1, 2, 3)</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">Emission Factors</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">Climatiq API (IPCC AR6, EPA eGRID, IEA)</td></tr>
      <tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">Boundaries</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">Operational control approach; embodied + operational lifecycle</td></tr>
      <tr><td style="padding:6px 12px;font-weight:600;">Reporting Period</td><td style="padding:6px 12px;">Calendar year of project configuration</td></tr>
    </tbody>
  </table>

  <div class="footer">
    <p>This certificate is generated per the GHG Protocol Corporate Standard and the 2026 SCI for AI standard.</p>
    <p>All emission factors are sourced from peer-reviewed, publicly accessible databases via the Climatiq API.</p>
    <p>ImpactCheck · AI Infrastructure Carbon Accounting Platform · ${dateStr}</p>
  </div>
</body></html>`;
}

export function AuditCertificate({ report, projectName, primaryRegion }: AuditCertificateProps) {
  const primaryTotal = report.totalsByRegion[primaryRegion] ?? 0;
  const usCompliance = report.compliance.us.status;
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];

  const handleDownloadPDF = useCallback(() => {
    const html = generateCertificateHTML(report, projectName, primaryRegion);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    // Give the browser a moment to render, then trigger print (Save as PDF)
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }, [report, projectName, primaryRegion]);

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
            <span className="text-muted-foreground font-normal text-sm">GHG Protocol Audit Certificate</span>
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

          {/* Download button */}
          <Button onClick={handleDownloadPDF} variant="outline" className="w-full gap-2 rounded-xl">
            <Download className="h-4 w-4" />
            Download PDF Certificate
          </Button>

          <div className="text-center text-[10px] text-muted-foreground space-y-1">
            <p>This certificate is generated per the GHG Protocol Corporate Standard and the 2026 SCI for AI standard.</p>
            <p>ImpactCheck · AI Infrastructure Carbon Accounting Platform</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
