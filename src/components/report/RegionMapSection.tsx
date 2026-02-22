import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { REGION_LABELS, REGION_COORDS } from "@/lib/regions";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Props {
  totalsByRegion: Record<string, number>;
  hero?: boolean;
}

export function RegionMapSection({ totalsByRegion, hero }: Props) {
  const maxVal = Math.max(...Object.values(totalsByRegion), 1);
  const markers = Object.entries(totalsByRegion)
    .filter(([region]) => REGION_COORDS[region])
    .map(([region, total]) => ({
      region,
      label: REGION_LABELS[region] ?? region,
      coords: REGION_COORDS[region],
      total,
      size: 4 + (total / maxVal) * 14,
    }));

  return (
    <Card className={`card-elevated border-0 overflow-hidden ${hero ? "ring-1 ring-primary/20" : ""}`}>
      <CardHeader>
        <CardTitle className={hero ? "text-xl" : "text-lg"}>Emissions by Region</CardTitle>
        <CardDescription>Geographic distribution of CO₂e</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pb-4">
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#18181b" }}>
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 110, center: [10, 20] }}
            style={{ width: "100%", height: "auto" }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#27272a"
                    stroke="#3f3f46"
                    strokeWidth={0.5}
                    style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }}
                  />
                ))
              }
            </Geographies>

            {markers.map(({ region, coords, size, label, total }) => (
              <Marker key={region} coordinates={coords}>
                <circle r={size * 1.8} fill="hsl(var(--primary))" fillOpacity={0.15} />
                <circle r={size} fill="hsl(var(--primary))" fillOpacity={0.9} />
                <title>{label}: {formatTonnes(total)} t CO₂e</title>
              </Marker>
            ))}
          </ComposableMap>
          <div className="px-3 pb-2.5 pt-0.5 flex flex-wrap gap-x-3 gap-y-1">
            {markers.map(({ region, label, total }) => (
              <div key={region} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                {label} · {formatTonnes(total)} t
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
