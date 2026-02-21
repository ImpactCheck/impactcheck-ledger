import { useState, useMemo } from "react";
import { AuditInputs, DEFAULT_INPUTS, calculateSCIScore, getComplianceLevel, generateOperationalTimeline } from "@/lib/carbon-calculations";
import { HeroMetrics } from "@/components/HeroMetrics";
import { AuditInputPanel } from "@/components/AuditInputPanel";
import { EmbodiedChart } from "@/components/EmbodiedChart";
import { OperationalChart } from "@/components/OperationalChart";
import { AuditCertificate } from "@/components/AuditCertificate";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings2, Leaf } from "lucide-react";

const LegacyDashboard = () => {
  const [inputs, setInputs] = useState<AuditInputs>(DEFAULT_INPUTS);

  const results = useMemo(() => calculateSCIScore(inputs), [inputs]);
  const timeline = useMemo(() => generateOperationalTimeline(inputs), [inputs]);
  const compliance = getComplianceLevel(results.sciScore);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2.5">
            <Leaf className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-gradient-green">Impact</span>Check
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground border rounded px-1.5 py-0.5 ml-1">Legacy</span>
          </div>
          <div className="flex items-center gap-2">
            <AuditCertificate inputs={inputs} />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 overflow-y-auto bg-card">
                <AuditInputPanel inputs={inputs} onChange={setInputs} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="container px-4 py-6">
        <div className="flex gap-6">
          <main className="flex-1 space-y-6 min-w-0">
            <HeroMetrics
              totalCarbon={results.totalCarbon}
              embodiedTotal={results.embodied.total}
              operationalAnnual={results.operational.annualKg}
              sciScore={results.sciScore}
              complianceLevel={compliance}
            />
            <div className="grid md:grid-cols-2 gap-6">
              <EmbodiedChart
                gpuCarbon={results.embodied.gpuCarbon}
                coolingCarbon={results.embodied.coolingCarbon}
                concreteCarbon={results.embodied.concreteCarbon}
              />
              <OperationalChart data={timeline} />
            </div>
            <div className="rounded-lg border bg-card/50 p-4 text-xs text-muted-foreground font-mono space-y-1">
              <p><strong className="text-foreground">Methodology:</strong> SCI for AI Standard (2026)</p>
              <p>C<sub>embodied</sub> = (GPU_Qty × 2,274 kg) + (Cooling × 850 kg) + (Concrete_MT × {inputs.lowCarbonConcrete ? '450' : '900'} kg)</p>
              <p>C<sub>operational</sub> = Power_MW × PUE × Grid_Intensity × 8,760 hrs</p>
              <p>SCI = (C<sub>e</sub> + C<sub>o</sub>) / Total_Tokens_Projected</p>
            </div>
          </main>
          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-20 rounded-lg border bg-card p-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <AuditInputPanel inputs={inputs} onChange={setInputs} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default LegacyDashboard;
