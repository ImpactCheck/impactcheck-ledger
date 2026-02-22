/** Supported regions for home and comparison (EU, Norway, US, Iceland) */
export const SUPPORTED_REGIONS = ["eu", "norway", "us", "iceland"] as const;
export type SupportedRegion = (typeof SUPPORTED_REGIONS)[number];

export const REGION_LABELS: Record<string, string> = {
  eu: "EU",
  norway: "Norway",
  us: "US",
  iceland: "Iceland",
};

export const REGION_COORDS: Record<string, [number, number]> = {
  eu: [10, 50],
  norway: [10, 60],
  us: [-95, 38],
  iceland: [-22, 65],
};
