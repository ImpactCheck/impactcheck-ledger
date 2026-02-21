import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatTonnes } from "@/contracts/impactcheck.v2";

interface EmbodiedChartProps {
  gpuCarbon: number;
  coolingCarbon: number;
  concreteCarbon: number;
}

const COLORS = ["hsl(152 52% 40%)", "hsl(152 40% 52%)", "hsl(154 50% 28%)"];

export function EmbodiedChart({ gpuCarbon, coolingCarbon, concreteCarbon }: EmbodiedChartProps) {
  const data = [
    { name: "GPU Racks", value: gpuCarbon },
    { name: "Cooling", value: coolingCarbon },
    { name: "Concrete", value: concreteCarbon },
  ];

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 card-elevated">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Bucket A — The Build</h3>
        <p className="text-xs text-muted-foreground">Embodied Carbon Debt</p>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatTonnes(v)} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(40 15% 90%)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              formatter={(value: number) => [`${formatTonnes(value)} tonnes CO₂e`, ""]}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
