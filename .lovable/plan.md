

# Multi-Tier Subscription Plans

## Overview

Replace the current single "Pro" plan ($99/month) with four tiers: **Free**, **Companies** ($149/month), **Investors & VCs** ($199/month), and **Regulators** ($299/month). Each tier has distinct limits and report output styles. The account type directly controls the report presentation layout (already partially implemented via `useCase`).

---

## Tier Definitions

| | Free | Companies | Investors & VCs | Regulators |
|---|---|---|---|---|
| Price | $0 | $149/mo per seat | $199/mo per seat | $299/mo per seat |
| Uploads | None | Yes | Yes | Yes |
| Reports/month | 3 generates | 10 | 100 | 50 |
| PDF export | No | Yes | Yes | Yes |
| Report focus | Basic | Emissions + compliance + strategy | Investment feasibility highlights | In-depth compliance + long-term evidence |
| Support overflow | -- | -- | -- | Contact impactchecker@service.com |

---

## Implementation Steps

### 1. Create Stripe Products and Prices

Create three new Stripe products with monthly recurring prices using the Stripe tools:
- **ImpactCheck Companies** -- $149/month (price in cents: 14900)
- **ImpactCheck Investors** -- $199/month (price in cents: 19900)
- **ImpactCheck Regulators** -- $299/month (price in cents: 29900)

The existing "ImpactCheck Pro" product (prod_U1VqCUATGGt85h / price_1T3SopAqTnUFmnpWJXW5fnK0 at $99) will be archived or left for legacy subscribers.

### 2. Create a Tier Config Constant

Add a new file `src/lib/subscription-tiers.ts` containing the tier definitions (product IDs, price IDs, features, limits, mapped `useCase`). This becomes the single source of truth for both UI and backend logic.

```text
TIERS = {
  free:      { useCase: "other",     reports: 3,   uploads: false, pdf: false },
  company:   { useCase: "company",   reports: 10,  uploads: true,  pdf: true,  priceId: "price_xxx", productId: "prod_xxx" },
  investor:  { useCase: "investor",  reports: 100, uploads: true,  pdf: true,  priceId: "price_yyy", productId: "prod_yyy" },
  regulator: { useCase: "regulator", reports: 50,  uploads: true,  pdf: true,  priceId: "price_zzz", productId: "prod_zzz" },
}
```

### 3. Update AuthContext

- Add `subscriptionTier` (free | company | investor | regulator) and `reportsRemaining` to `AuthState`.
- The `check-subscription` edge function already returns `product_id`; map it to the tier using the config constant.
- Expose the tier so components can gate features (uploads, PDF export, generate count).

### 4. Update `check-subscription` Edge Function

- Return `product_id` from the active subscription (already partially implemented).
- No other changes needed; the frontend maps `product_id` to the tier.

### 5. Update `create-checkout` Edge Function

- Accept a `tier` parameter in the request body (company | investor | regulator).
- Look up the correct `price_id` from a server-side tier map and create the checkout session with that price.

### 6. Update Landing Page Pricing Section

Replace the current 2-column (Free / Pro) layout with a 4-column grid:

- **Free** -- $0/mo, 3 generates, no uploads, no PDF. "Get Started Free" button.
- **Companies** -- $149/mo per seat, 10 reports/mo, PDF export, emissions + compliance + strategy focus. "Subscribe" button.
- **Investors & VCs** -- $199/mo per seat, 100 reports/mo, investment feasibility focus. "Subscribe" button with "Popular" badge.
- **Regulators** -- $299/mo per seat, 50 reports/mo, in-depth compliance + evidence-based long-term analysis, PDF export. "Subscribe" button. Note: "Run out of prompts? Contact impactchecker@service.com".

Each paid tier's subscribe button calls `create-checkout` with the corresponding tier parameter.

### 7. Link Subscription Tier to Report Output

The existing `useCase` in `ProjectContext` already drives `getReportLayout()` which controls section ordering, hero sections, and limits. When a user's subscription tier is known:

- Auto-set the `useCase` to match their tier (company -> "company", investor -> "investor", regulator -> "regulator", free -> "other").
- This automatically tailors the report output: investors see feasibility-focused reports, regulators see compliance-heavy reports, companies see emissions + strategy reports.

### 8. Enforce Limits in the Frontend

- **Uploads**: Disable the upload page/button for free-tier users with a message to upgrade.
- **Report generation count**: Track generates per month (can use a simple counter in the profiles table or a new `usage` table). Show remaining count in the UI. Block generation when limit is reached.
- **PDF export**: Hide or disable the PDF export button for free-tier users.

---

## Technical Details

### New/Modified Files

| File | Action |
|---|---|
| `src/lib/subscription-tiers.ts` | New -- tier definitions with Stripe IDs, limits, features |
| `src/contexts/AuthContext.tsx` | Modify -- add `subscriptionTier`, map `product_id` to tier |
| `supabase/functions/create-checkout/index.ts` | Modify -- accept `tier` param, lookup price dynamically |
| `supabase/functions/check-subscription/index.ts` | Minor -- ensure `product_id` is returned (already mostly done) |
| `src/pages/Landing.tsx` | Modify -- replace 2-col pricing with 4-col tier cards |
| `src/contexts/ProjectContext.tsx` | Minor -- auto-set `useCase` from subscription tier |
| `src/pages/Upload.tsx` | Modify -- gate uploads behind paid tier |
| `src/pages/Report.tsx` | Minor -- gate PDF export behind paid tier |

### Database Changes

Add a `monthly_report_count` and `report_count_reset_at` column to the `profiles` table to track per-month report generation usage. This avoids needing a separate usage table.

