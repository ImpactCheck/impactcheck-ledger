import { ComplianceBadge } from "./ComplianceBadge";
import { formatTonnes, formatNumber } from "@/contracts/impactcheck.v2";
import { Activity, Factory, Zap, BarChart3 } from "lucide-react";

interface HeroMetricsProps {
  totalCarbon: number;
  embodiedTotal: number;
  operationalAnnual: number;
  sciScore: number;
  complianceLevel: "green" | "yellow" | "red";
}

function MetricCard({ label, value, unit, icon: Icon, accent }: {
  label: string; value: string; unit: string; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-glow glow-green bg-primary/5' : 'bg-card'}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold font-mono animate-count-up ${accent ? 'text-gradient-green' : 'text-foreground'}`}>
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

export function HeroMetrics({ totalCarbon, embodiedTotal, operationalAnnual, sciScore, complianceLevel }: HeroMetricsProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Total Lifecycle Carbon Score</h2>
          <p className="text-4xl font-bold font-mono text-gradient-green mt-1">
            {formatTonnes(totalCarbon)} <span className="text-lg text-muted-foreground font-normal">tonnes CO₂e</span>
          </p>
        </div>
        <ComplianceBadge level={complianceLevel} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="SCI Score" value={sciScore.toFixed(3)} unit="gCO₂e/token" icon={Activity} accent />
        <MetricCard label="Embodied Debt" value={formatTonnes(embodiedTotal)} unit="tonnes" icon={Factory} />
        <MetricCard label="Annual Ops" value={formatTonnes(operationalAnnual)} unit="tonnes/yr" icon={Zap} />
        <MetricCard label="Intensity" value={formatNumber(totalCarbon > 0 ? operationalAnnual / totalCarbon * 100 : 0)} unit="% ops" icon={BarChart3} />
      </div>
    </div>
  );
}
