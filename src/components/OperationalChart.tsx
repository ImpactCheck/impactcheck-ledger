import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from "recharts";
import { formatTonnes } from "@/contracts/impactcheck.v2";

interface TimelinePoint {
  month: string;
  emissions: number;
  tps: number;
}

interface OperationalChartProps {
  data: TimelinePoint[];
}

export function OperationalChart({ data }: OperationalChartProps) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 card-elevated">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Bucket B — The Pulse</h3>
        <p className="text-xs text-muted-foreground">Operational Carbon vs. Throughput</p>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="emissionsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatTonnes(v)} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v} TPS`} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(40 15% 90%)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
            />
            <Area yAxisId="left" type="monotone" dataKey="emissions" stroke="hsl(var(--primary))" fill="url(#emissionsGrad)" strokeWidth={2} name="Emissions (tonnes)" />
            <Line yAxisId="right" type="monotone" dataKey="tps" stroke="hsl(152 40% 52%)" strokeWidth={2} dot={false} name="Tokens/sec" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
