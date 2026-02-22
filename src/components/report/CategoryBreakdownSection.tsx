import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatTonnes, getActivityPhase } from "@/contracts/impactcheck.v2";

const EMBODIED_COLOR = "hsl(30 80% 55%)";
const OPERATIONAL_COLOR = "hsl(200 70% 50%)";

const COLOR_CACHE: Record<string, string> = {};
function getCategoryColor(category: string): string {
  const phase = getActivityPhase(category);
  if (!COLOR_CACHE[category]) {
    const embodiedPalette = ["hsl(30 80% 55%)", "hsl(35 75% 50%)", "hsl(25 70% 45%)", "hsl(40 65% 60%)"];
    const operationalPalette = ["hsl(200 70% 50%)", "hsl(210 65% 55%)", "hsl(190 60% 45%)", "hsl(180 55% 50%)", "hsl(220 60% 55%)"];
    const palette = phase === "embodied" ? embodiedPalette : operationalPalette;
    const existing = Object.keys(COLOR_CACHE).filter(k => getActivityPhase(k) === phase).length;
    COLOR_CACHE[category] = palette[existing % palette.length];
  }
  return COLOR_CACHE[category];
}

interface Props {
  categories: { category: string; co2eKg: number }[];
  primaryRegion: string;
  hero?: boolean;
}

export function CategoryBreakdownSection({ categories, primaryRegion, hero }: Props) {
  return (
    <Card className={`card-elevated border-0 print:border print:shadow-none ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={hero ? "text-xl" : "text-lg"}>Category Breakdown</CardTitle>
        <CardDescription>Emissions by GHG Protocol category for {primaryRegion.replace(/_/g, " ")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="category" tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220 10% 46%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatTonnes(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(40 15% 90%)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                formatter={(value: number) => [`${formatTonnes(value)} t CO₂e`, ""]}
              />
              <Bar dataKey="co2eKg" radius={[6, 6, 0, 0]}>
                {categories.map((c, i) => <Cell key={i} fill={getCategoryColor(c.category)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EMBODIED_COLOR }} />
            Embodied
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: OPERATIONAL_COLOR }} />
            Operational
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
