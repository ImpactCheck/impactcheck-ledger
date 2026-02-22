export interface AuditInputs {
  gpuRacks: number;
  coolingUnits: number;
  concreteMT: number;
  lowCarbonConcrete: boolean;
  powerMW: number;
  pue: number;
  region: string;
  projectedTokensBillions: number;
}

export interface RegionData {
  name: string;
  gridIntensity: number; // g CO2e / kWh
  label: string;
}

export const REGIONS: RegionData[] = [
  { name: "eu", gridIntensity: 350, label: "EU (Mixed grid — ~350 g/kWh)" },
  { name: "norway", gridIntensity: 10, label: "Norway (Hydro — ~10 g/kWh)" },
  { name: "us", gridIntensity: 380, label: "US (Mixed grid — ~380 g/kWh)" },
  { name: "iceland", gridIntensity: 15, label: "Iceland (Geothermal — ~15 g/kWh)" },
];

const GPU_EMBODIED_KG = 2274; // kg CO2e per GB200 NVL72 rack
const COOLING_EMBODIED_KG = 850;
const CONCRETE_STD_KG = 900; // kg CO2e per MT
const CONCRETE_LOW_KG = 450;
const HOURS_PER_YEAR = 8760;

export function calculateEmbodiedCarbon(inputs: AuditInputs) {
  const gpuCarbon = inputs.gpuRacks * GPU_EMBODIED_KG;
  const coolingCarbon = inputs.coolingUnits * COOLING_EMBODIED_KG;
  const concreteRate = inputs.lowCarbonConcrete ? CONCRETE_LOW_KG : CONCRETE_STD_KG;
  const concreteCarbon = inputs.concreteMT * concreteRate;
  return { gpuCarbon, coolingCarbon, concreteCarbon, total: gpuCarbon + coolingCarbon + concreteCarbon };
}

export function calculateOperationalCarbon(inputs: AuditInputs) {
  const region = REGIONS.find(r => r.name === inputs.region) || REGIONS[0];
  // Power_MW * PUE * grid_intensity (g/kWh) * hours/year → kg/year (÷1000)
  const annualKg = inputs.powerMW * 1000 * inputs.pue * region.gridIntensity * HOURS_PER_YEAR / 1000;
  return { annualKg, gridIntensity: region.gridIntensity };
}

export function calculateSCIScore(inputs: AuditInputs) {
  const embodied = calculateEmbodiedCarbon(inputs);
  const operational = calculateOperationalCarbon(inputs);
  const totalTokens = inputs.projectedTokensBillions * 1e9;
  const sciScore = totalTokens > 0 ? ((embodied.total + operational.annualKg) / totalTokens) * 1e6 : 0;
  return { embodied, operational, sciScore, totalCarbon: embodied.total + operational.annualKg };
}

export function getComplianceLevel(sciScore: number): "green" | "yellow" | "red" {
  if (sciScore < 0.5) return "green";
  if (sciScore < 2.0) return "yellow";
  return "red";
}

export function formatTonnes(kg: number): string {
  if (kg >= 1e6) return `${(kg / 1e6).toFixed(1)}M`;
  if (kg >= 1e3) return `${(kg / 1e3).toFixed(1)}K`;
  return kg.toFixed(0);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export const DEFAULT_INPUTS: AuditInputs = {
  gpuRacks: 256,
  coolingUnits: 64,
  concreteMT: 12000,
  lowCarbonConcrete: false,
  powerMW: 500,
  pue: 1.2,
  region: "us",
  projectedTokensBillions: 50,
};

// Generate mock operational timeline data
export function generateOperationalTimeline(inputs: AuditInputs) {
  const region = REGIONS.find(r => r.name === inputs.region) || REGIONS[0];
  const baseEmissions = inputs.powerMW * inputs.pue * region.gridIntensity / 1000;
  
  return Array.from({ length: 12 }, (_, i) => {
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i];
    const seasonalFactor = 1 + 0.15 * Math.sin((i - 3) * Math.PI / 6);
    const tps = (800 + i * 120) * (0.9 + Math.random() * 0.2);
    const emissions = baseEmissions * seasonalFactor * (0.95 + Math.random() * 0.1);
    return { month, emissions: Math.round(emissions), tps: Math.round(tps) };
  });
}
