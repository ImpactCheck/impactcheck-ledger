/** Supported regions for home and comparison — ISO codes */
export const SUPPORTED_REGIONS = ["EU", "NO", "US", "IS"] as const;
export type SupportedRegion = (typeof SUPPORTED_REGIONS)[number];

export const REGION_LABELS: Record<string, string> = {
  EU: "EU",
  NO: "Norway",
  US: "US",
  IS: "Iceland",
};

export const REGION_COORDS: Record<string, [number, number]> = {
  EU: [10, 50],
  NO: [10, 60],
  US: [-95, 38],
  IS: [-22, 65],
};
