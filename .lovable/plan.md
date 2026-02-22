

# Multi-Tier Subscription Plans — IMPLEMENTED

## Overview

Replaced the single "Pro" plan ($99/month) with four tiers: **Free**, **Companies** ($149/month), **Investors & VCs** ($199/month), and **Regulators** ($299/month). Each tier has distinct limits and report output styles. The account type directly controls the report presentation layout via `useCase`.

---

## Stripe Products Created

| Tier | Product ID | Price ID | Monthly |
|---|---|---|---|
| Companies | prod_U1a0nFSXZRnq2X | price_1T3WqAAqTnUFmnpWefGHCmKH | $149 |
| Investors & VCs | prod_U1a05BbM5ChHh2 | price_1T3WqKAqTnUFmnpW9G6UNOzm | $199 |
| Regulators | prod_U1a0wOWJMRgkZd | price_1T3WqLAqTnUFmnpW2F1nQbyc | $299 |

Legacy Pro product (prod_U1VqCUATGGt85h / price_1T3SopAqTnUFmnpWJXW5fnK0 at $99) maps to "company" tier as fallback.

## What Was Implemented

1. ✅ Created 3 Stripe products with monthly recurring prices
2. ✅ Created `src/lib/subscription-tiers.ts` — single source of truth for tier definitions
3. ✅ Updated `AuthContext` — added `subscriptionTier`, maps `product_id` from check-subscription
4. ✅ Updated `check-subscription` edge function — returns `product_id` from active subscription
5. ✅ Updated `create-checkout` edge function — accepts `tier` param, looks up price dynamically
6. ✅ Updated Landing page — 4-column pricing grid with all tier details
7. ✅ Added `TierSync` component — auto-sets `useCase` in ProjectContext from subscription tier
8. ✅ Gated uploads — free-tier users see a lock overlay with upgrade CTA
9. ✅ Gated PDF export — disabled print/export button for free-tier users

## Remaining (Future)

- Database migration: add `monthly_report_count` and `report_count_reset_at` to profiles table
- Enforce report generation count limits per tier
- Show remaining report count in the UI
