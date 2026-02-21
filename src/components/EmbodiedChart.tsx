import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatTonnes } from "@/contracts/impactcheck.v2";

interface EmbodiedChartProps {
  gpuCarbon: number;
  coolingCarbon: number;
  concreteCarbon: number;
}

const COLORS = ["hsl(145 55% 42%)", "hsl(145 45% 55%)", "hsl(145 55% 32%)"];

export function EmbodiedChart({ gpuCarbon, coolingCarbon, concreteCarbon }: EmbodiedChartProps) {
  const data = [
    { name: "GPU Racks", value: gpuCarbon },
    { name: "Cooling", value: coolingCarbon },
    { name: "Concrete", value: concreteCarbon },
  ];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Bucket A — The Build</h3>
        <p className="text-xs text-muted-foreground">Embodied Carbon Debt</p>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(215 15% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215 15% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatTonnes(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(220 18% 13%)", border: "1px solid hsl(220 15% 20%)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "hsl(210 20% 90%)" }}
              formatter={(value: number) => [`${formatTonnes(value)} tonnes CO₂e`, ""]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
