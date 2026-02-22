import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Label, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import type { PhaseTotals } from "@/contracts/impactcheck.v2";

const EMBODIED_COLOR = "hsl(30 80% 55%)";
const OPERATIONAL_COLOR = "hsl(200 70% 50%)";

interface Props {
  phaseTotals: PhaseTotals;
  hero?: boolean;
}

export function PhaseSplitSection({ phaseTotals, hero }: Props) {
  const { embodied, operational } = phaseTotals;
  const total = embodied + operational;

  if (total === 0) return null;

  const opPct = Math.round((operational / total) * 100);
  const embPct = 100 - opPct;
  const largerLabel = opPct >= embPct ? `${opPct}% Operational` : `${embPct}% Embodied`;

  const data = [
    { name: "Embodied", value: embodied },
    { name: "Operational", value: operational },
  ];
  const colors = [EMBODIED_COLOR, OPERATIONAL_COLOR];

  return (
    <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={hero ? "text-xl" : "text-lg"}>Embodied vs Operational Split</CardTitle>
        <CardDescription>Breakdown of lifecycle carbon by emission phase</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i]} />
                ))}
                <Label
                  value={largerLabel}
                  position="center"
                  style={{ fontSize: 12, fill: "hsl(220 10% 46%)", fontWeight: 600 }}
                />
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                formatter={(value: number) => [`${formatTonnes(value)} t CO₂e`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 justify-center text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EMBODIED_COLOR }} />
            Embodied: {formatTonnes(embodied)} t
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: OPERATIONAL_COLOR }} />
            Operational: {formatTonnes(operational)} t
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
