import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from "recharts";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { useTheme } from "@/contexts/ThemeContext";

interface TimelinePoint {
  month: string;
  emissions: number;
  tps: number;
}

interface OperationalChartProps {
  data: TimelinePoint[];
}

export function OperationalChart({ data }: OperationalChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const gridStroke = isDark ? "hsl(220 15% 20%)" : "hsl(220 15% 92%)";
  const tickFill = isDark ? "hsl(215 15% 55%)" : "hsl(220 10% 45%)";
  const tooltipBg = isDark ? "hsl(220 18% 13%)" : "hsl(0 0% 100%)";
  const tooltipBorder = isDark ? "hsl(220 15% 20%)" : "hsl(220 15% 92%)";
  const labelColor = isDark ? "hsl(210 20% 90%)" : "hsl(220 10% 20%)";

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
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatTonnes(v)} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: tickFill, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v} TPS`} />
            <Tooltip
              contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: labelColor }}
            />
            <Area yAxisId="left" type="monotone" dataKey="emissions" stroke="hsl(var(--primary))" fill="url(#emissionsGrad)" strokeWidth={2} name="Emissions (tonnes)" />
            <Line yAxisId="right" type="monotone" dataKey="tps" stroke="hsl(145 45% 55%)" strokeWidth={2} dot={false} name="Tokens/sec" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
