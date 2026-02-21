import { AuditInputs, REGIONS } from "@/lib/carbon-calculations";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Cpu, Building2, MapPin, Gauge } from "lucide-react";

interface AuditInputPanelProps {
  inputs: AuditInputs;
  onChange: (inputs: AuditInputs) => void;
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="space-y-3 pl-6">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function AuditInputPanel({ inputs, onChange }: AuditInputPanelProps) {
  const update = (partial: Partial<AuditInputs>) => onChange({ ...inputs, ...partial });

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h3 className="text-lg font-bold">Audit Configuration</h3>
        <p className="text-xs text-muted-foreground mt-0.5">SCI for AI Standard · 2026</p>
      </div>

      <Section title="Hardware BOM" icon={Cpu}>
        <Field label="NVIDIA GB200 NVL72 Racks">
          <Input type="number" value={inputs.gpuRacks} onChange={e => update({ gpuRacks: +e.target.value })} className="font-mono bg-secondary" />
          <p className="text-[10px] text-muted-foreground">2,274 kg CO₂e embodied per rack</p>
        </Field>
        <Field label="Liquid Cooling Units">
          <Input type="number" value={inputs.coolingUnits} onChange={e => update({ coolingUnits: +e.target.value })} className="font-mono bg-secondary" />
        </Field>
      </Section>

      <Section title="Facility" icon={Building2}>
        <Field label="Concrete (metric tonnes)">
          <Input type="number" value={inputs.concreteMT} onChange={e => update({ concreteMT: +e.target.value })} className="font-mono bg-secondary" />
        </Field>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Low-Carbon Concrete Mix</Label>
          <Switch checked={inputs.lowCarbonConcrete} onCheckedChange={v => update({ lowCarbonConcrete: v })} />
        </div>
        <Field label={`Total Power Capacity: ${inputs.powerMW} MW`}>
          <Slider value={[inputs.powerMW]} onValueChange={([v]) => update({ powerMW: v })} min={10} max={2000} step={10} className="mt-2" />
        </Field>
        <Field label={`PUE: ${inputs.pue.toFixed(2)}`}>
          <Slider value={[inputs.pue * 100]} onValueChange={([v]) => update({ pue: v / 100 })} min={100} max={200} step={1} className="mt-2" />
        </Field>
      </Section>

      <Section title="Region" icon={MapPin}>
        <Select value={inputs.region} onValueChange={v => update({ region: v })}>
          <SelectTrigger className="bg-secondary font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map(r => (
              <SelectItem key={r.name} value={r.name} className="text-xs">{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>

      <Section title="Projections" icon={Gauge}>
        <Field label="Projected Tokens (Billions)">
          <Input type="number" value={inputs.projectedTokensBillions} onChange={e => update({ projectedTokensBillions: +e.target.value })} className="font-mono bg-secondary" />
        </Field>
      </Section>
    </div>
  );
}
