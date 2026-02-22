import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatTonnes } from "@/contracts/impactcheck.v2";

interface Props {
  regionData: { region: string; total: number }[];
  hero?: boolean;
}

export function RegionComparisonSection({ regionData, hero }: Props) {
  return (
    <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={hero ? "text-xl" : "text-lg"}>Per-Region Comparison</CardTitle>
        <CardDescription>Total CO₂e by region</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regionData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="region" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatTonnes(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(40 15% 90%)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                formatter={(value: number) => [`${formatTonnes(value)} t CO₂e`, ""]}
              />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="hsl(152 52% 40%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
