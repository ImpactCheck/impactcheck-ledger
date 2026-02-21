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
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Bucket B — The Pulse</h3>
        <p className="text-xs text-muted-foreground">Operational Carbon vs. Throughput</p>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="emissionsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(145 63% 42%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(145 63% 42%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(215 15% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: "hsl(215 15% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatTonnes(v)} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(215 15% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v} TPS`} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(220 18% 13%)", border: "1px solid hsl(220 15% 20%)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "hsl(210 20% 90%)" }}
            />
            <Area yAxisId="left" type="monotone" dataKey="emissions" stroke="hsl(145 63% 42%)" fill="url(#emissionsGrad)" strokeWidth={2} name="Emissions (tonnes)" />
            <Line yAxisId="right" type="monotone" dataKey="tps" stroke="hsl(200 70% 50%)" strokeWidth={2} dot={false} name="Tokens/sec" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
