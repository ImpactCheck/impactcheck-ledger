import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

interface Props {
  hero?: boolean;
}

/** Displays standard assumptions and system boundaries per GHG Protocol. */
export function AssumptionsSection({ hero }: Props) {
  const assumptions = [
    "Scope 1, 2, and partial Scope 3 emissions are included per GHG Protocol Corporate Standard.",
    "Embodied carbon covers hardware procurement, construction materials, and infrastructure deployment. It is incurred once in Year 1 only, alongside operational costs.",
    "Operational carbon covers energy consumption, cooling, and ongoing maintenance. It recurs every year.",
    "In subsequent years (Year 2 onward), only operational carbon applies; no embodied costs are attributed per year.",
    "Emission factors are matched to the closest available region; global averages are used as fallback.",
    "Financial data (spend-based estimates) uses Climatiq monetary emission factors when physical quantities are unavailable.",
    "System boundary includes cradle-to-gate for embodied emissions; gate-to-grave is excluded unless explicitly modeled.",
    "Uncertainty from emission factor matching is reflected in confidence scores but not propagated as error bars.",
  ];

  return (
    <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${hero ? "text-xl" : "text-lg"}`}>
          <Info className="h-4 w-4 text-muted-foreground" />
          Assumptions & Boundaries
        </CardTitle>
        <CardDescription>Key assumptions and system boundaries applied to this assessment per GHG Protocol guidance.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {assumptions.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
