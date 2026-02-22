

## Distinguish Embodied vs Operational Activities

Activities extracted from documents fall into two fundamentally different categories: **embodied** (one-time, like building materials) and **operational** (recurring, like annual electricity). This plan adds that distinction to the data model, the Activities page UI, and the Report page.

### What Changes

**1. Add `category` to the frontend data model**

The `activities` table already stores a `category` column (populated by the AI extraction with values like `HARDWARE`, `CONSTRUCTION`, `ENERGY`, `OPERATIONS`, etc.), but the frontend `ExtractedActivity` interface does not include it. We will add it.

In `src/contracts/impactcheck.v2.ts`, add `category?: string` to `ExtractedActivity`.

**2. Define the Embodied/Operational classification**

Create a simple helper that maps the raw category values to a lifecycle phase:

- **Embodied** (one-time): `HARDWARE`, `CONSTRUCTION`, `PROCUREMENT`
- **Operational** (recurring per year): `ENERGY`, `OPERATIONS`, `WATER`, `TRANSPORT`, `WASTE`, `OTHER`

This will be a small utility, either in the contracts file or a shared lib.

**3. Update the Activities page to display the type**

The Activities page will:
- Show a colored badge on each activity row indicating "Embodied" or "Operational"
- Group activities by lifecycle phase using tabs or section headers: an "Embodied (One-time)" section and an "Operational (Annual)" section, nested within the existing region tabs if multi-region
- Display counts for each section (e.g., "12 embodied, 18 operational")

**4. Update the Supabase adapter to include `category`**

In `src/api/adapters/supabaseAdapter.ts`, ensure `category` is selected and mapped when fetching activities, and included when upserting them.

**5. Update the Report page to separate embodied vs operational totals**

The Report page will show:
- The hero card still displays the **total lifecycle** figure
- Below it, two summary cards side by side:
  - **Embodied Carbon** -- total one-time emissions from construction/hardware
  - **Operational Carbon** -- total annual recurring emissions from energy/operations
- The category breakdown chart will color-code bars by lifecycle phase
- Hotspots will show a small "Embodied" or "Operational" label next to each item

**6. Update the Report data contract**

Add optional `embodiedTotalByRegion` and `operationalTotalByRegion` fields to the `Report` interface so the backend (or frontend aggregation) can provide the split. Alternatively, compute this client-side from `categoryBreakdownByRegion` using the classification helper -- this is simpler and avoids backend changes.

The plan favors **client-side derivation**: the existing `categoryBreakdownByRegion` data already has category names, so the frontend simply sums categories into embodied vs operational buckets. No backend/edge function changes needed.

### Technical Details

**Files to modify:**

| File | Change |
|------|--------|
| `src/contracts/impactcheck.v2.ts` | Add `category?: string` to `ExtractedActivity`. Add `ActivityPhase` type and `getActivityPhase()` helper. |
| `src/api/adapters/supabaseAdapter.ts` | Include `category` in activity select/insert queries. |
| `src/api/adapters/mockAdapter.ts` | Add `category` to mock activity data. |
| `src/pages/Activities.tsx` | Add phase grouping (two sections or sub-tabs) and phase badges on each row. |
| `src/pages/Report.tsx` | Add embodied/operational summary cards derived from `categoryBreakdownByRegion`. Tag hotspot items with phase labels. |

**Phase classification logic (new helper in contracts file):**

```text
function getActivityPhase(category: string | undefined): "embodied" | "operational"
  EMBODIED_CATEGORIES = ["HARDWARE", "CONSTRUCTION", "PROCUREMENT"]
  if category uppercased is in EMBODIED_CATEGORIES -> "embodied"
  else -> "operational"
```

**Activities page layout:**

```text
+------------------------------------------+
| Step 3 - Activities                      |
| AI Extraction card (unchanged)           |
+------------------------------------------+
| [Embodied (One-time)] [Operational (Annual)] |  <-- new phase tabs
|                                          |
| Section: 12 activities                   |
| +--------------------------------------+ |
| | Activity row  [Embodied] badge       | |
| | Activity row  [Embodied] badge       | |
| +--------------------------------------+ |
+------------------------------------------+
```

**Report page layout addition:**

```text
+-------------------+--------------------+
| Embodied Carbon   | Operational Carbon |
| 1,234 t CO2e      | 5,678 t CO2e       |
| (one-time)        | (per year)         |
+-------------------+--------------------+
```

No database migrations are needed since the `category` column already exists. No edge function changes are needed since the extraction prompt already populates the category field.
