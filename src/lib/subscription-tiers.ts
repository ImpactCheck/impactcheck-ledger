import type { UseCase } from "@/contexts/ProjectContext";

export type SubscriptionTier = "free" | "company" | "investor" | "regulator";

export interface TierDefinition {
  key: SubscriptionTier;
  label: string;
  useCase: UseCase;
  price: number; // monthly USD
  reportsPerMonth: number;
  uploads: boolean;
  pdfExport: boolean;
  priceId: string | null;
  productId: string | null;
  features: string[];
  description: string;
  overflow?: string;
}

export const TIERS: Record<SubscriptionTier, TierDefinition> = {
  free: {
    key: "free",
    label: "Free",
    useCase: "other",
    price: 0,
    reportsPerMonth: 3,
    uploads: true,  // Unlocked for demo
    pdfExport: true,  // Unlocked for demo
    priceId: null,
    productId: null,
    features: [
      "3 report generates / month",
      "Basic emission mapping",
      "Standard report view",
      "Document uploads",
      "PDF report export",
    ],
    description: "Explore ImpactCheck at no cost (demo: all features unlocked)",
  },
  company: {
    key: "company",
    label: "Companies",
    useCase: "company",
    price: 149,
    reportsPerMonth: 10,
    uploads: true,
    pdfExport: true,
    priceId: "price_1T3WqAAqTnUFmnpWefGHCmKH",
    productId: "prod_U1a0nFSXZRnq2X",
    features: [
      "10 reports / month",
      "Document uploads",
      "PDF report export",
      "Emissions + compliance strategy",
      "AI reduction recommendations",
    ],
    description: "Emissions, compliance & strategy reports",
  },
  investor: {
    key: "investor",
    label: "Investors & VCs",
    useCase: "investor",
    price: 199,
    reportsPerMonth: 100,
    uploads: true,
    pdfExport: true,
    priceId: "price_1T3WqKAqTnUFmnpW9G6UNOzm",
    productId: "prod_U1a05BbM5ChHh2",
    features: [
      "100 reports / month",
      "Document uploads",
      "PDF report export",
      "Investment feasibility highlights",
      "Portfolio-level assessment",
    ],
    description: "Independent due diligence reports",
  },
  regulator: {
    key: "regulator",
    label: "Regulators",
    useCase: "regulator",
    price: 299,
    reportsPerMonth: 50,
    uploads: true,
    pdfExport: true,
    priceId: "price_1T3WqLAqTnUFmnpW2F1nQbyc",
    productId: "prod_U1a0wOWJMRgkZd",
    features: [
      "50 reports / month",
      "Document uploads",
      "PDF report export",
      "In-depth compliance analysis",
      "Evidence-based long-term projections",
    ],
    description: "Compliance verification & evidence analysis",
    overflow: "Run out of prompts? Contact impactchecker@service.com",
  },
};

/** Map a Stripe product ID to a subscription tier */
export function tierFromProductId(productId: string | null | undefined): SubscriptionTier {
  if (!productId) return "free";
  for (const [key, tier] of Object.entries(TIERS)) {
    if (tier.productId === productId) return key as SubscriptionTier;
  }
  // Legacy Pro product fallback
  if (productId === "prod_U1VqCUATGGt85h") return "company";
  return "free";
}

/** Server-side tier map for edge functions (price lookup) */
export const TIER_PRICE_MAP: Record<string, string> = {
  company: "price_1T3WqAAqTnUFmnpWefGHCmKH",
  investor: "price_1T3WqKAqTnUFmnpW9G6UNOzm",
  regulator: "price_1T3WqLAqTnUFmnpW2F1nQbyc",
};
