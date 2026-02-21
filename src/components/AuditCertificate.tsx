import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AuditInputs, calculateSCIScore, getComplianceLevel, formatTonnes, formatNumber, REGIONS } from "@/lib/carbon-calculations";
import { FileText, Download } from "lucide-react";
import { ComplianceBadge } from "./ComplianceBadge";

interface AuditCertificateProps {
  inputs: AuditInputs;
}

export function AuditCertificate({ inputs }: AuditCertificateProps) {
  const { embodied, operational, sciScore, totalCarbon } = calculateSCIScore(inputs);
  const compliance = getComplianceLevel(sciScore);
  const region = REGIONS.find(r => r.name === inputs.region);

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
            <ComplianceBadge level={compliance} />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Lifecycle Carbon</p>
              <p className="text-2xl font-bold font-mono text-gradient-green">{formatTonnes(totalCarbon)} t</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">SCI Score (2026 Standard)</p>
              <p className="text-2xl font-bold font-mono">{sciScore.toFixed(4)} <span className="text-xs text-muted-foreground">gCO₂e/token</span></p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Infrastructure Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm font-mono">
              <Row label="GPU Racks" value={`${inputs.gpuRacks} × GB200 NVL72`} />
              <Row label="Cooling Units" value={String(inputs.coolingUnits)} />
              <Row label="Concrete" value={`${formatNumber(inputs.concreteMT)} MT ${inputs.lowCarbonConcrete ? '(Low-Carbon)' : '(Standard)'}`} />
              <Row label="Power Capacity" value={`${inputs.powerMW} MW`} />
              <Row label="PUE" value={inputs.pue.toFixed(2)} />
              <Row label="Region" value={region?.label || inputs.region} />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Embodied Carbon (The Build)</h4>
              <div className="space-y-1 text-sm font-mono">
                <p>GPU Manufacturing: <span className="text-foreground">{formatTonnes(embodied.gpuCarbon)} t</span></p>
                <p>Cooling Systems: <span className="text-foreground">{formatTonnes(embodied.coolingCarbon)} t</span></p>
                <p>Concrete: <span className="text-foreground">{formatTonnes(embodied.concreteCarbon)} t</span></p>
                <p className="font-semibold text-primary">Total: {formatTonnes(embodied.total)} t</p>
              </div>
            </div>
            <div>
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Operational Carbon (The Pulse)</h4>
              <div className="space-y-1 text-sm font-mono">
                <p>Annual Emissions: <span className="text-foreground">{formatTonnes(operational.annualKg)} t/yr</span></p>
                <p>Grid Intensity: <span className="text-foreground">{operational.gridIntensity} g/kWh</span></p>
              </div>
            </div>
          </div>

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </>
  );
}
