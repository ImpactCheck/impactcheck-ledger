

## Regional Simulation for Comparison Reports

### Problem
Currently, the mapping edge function processes all regions (primary + comparison) during the mapping step. The user wants comparison-region estimates to be generated as **simulations** at report time, keeping the reviewed home-region data untouched.

### Architecture

The plan introduces a **simulation layer** that runs at report time:

1. **New `simulation_estimates` table** -- stores comparison-region estimate results separately from reviewed home-region data in the `estimates` table.

2. **New `simulate-regions` edge function** -- takes the project's reviewed activities and re-runs the Climatiq mapping pipeline for each comparison region. Stores results in `simulation_estimates`. Returns a job ID for progress tracking.

3. **Modified `mapping` edge function** -- only processes the **primary region** (no longer iterates over comparison regions).

4. **Updated Report page** -- on load, checks if simulations are needed (comparison regions exist). If so, triggers the simulation job and shows a progress card. Once complete, fetches the report which now merges both datasets.

5. **Updated `getReport`** -- reads from both `estimates` (home region) and `simulation_estimates` (comparison regions) to build the multi-region report.

### Technical Details

#### 1. Database: `simulation_estimates` table

New table with the same schema as `estimates` plus a `simulation_region` column:

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | auto-generated |
| project_id | uuid | FK-like reference |
| activity_id | uuid | references activities |
| simulation_region | text | the comparison region being simulated |
| region | text | Climatiq region used |
| matched_factor | jsonb | same as estimates |
| confidence | numeric | same as estimates |
| co2e_kg | numeric | same as estimates |
| input_used | jsonb | same as estimates |
| created_at | timestamptz | default now() |

RLS: same open policy as `estimates` (matching current pattern).

#### 2. New Edge Function: `simulate-regions`

- Accepts `{ projectId }`.
- Creates a job of type `"simulation"`.
- Reads activities from `activities` table (the reviewed home-region data).
- Reads project's `comparison_regions`.
- For each comparison region, runs the same Climatiq search-then-estimate pipeline (reusing the mapping function's logic).
- Deletes old `simulation_estimates` for the project before inserting new ones.
- Updates job progress as it processes each region.
- The function structure mirrors the existing `mapping/index.ts` but only targets comparison regions and writes to `simulation_estimates`.

#### 3. Modify `mapping/index.ts`

Change lines 80-82 to only use `[primaryRegion]` instead of all project regions. This ensures mapping only produces estimates for the home region that the user has reviewed.

```
// Before:
const projectRegions = [proj?.primary_region, ...(proj?.comparison_regions || [])].filter(Boolean);
const regionsToEstimate = projectRegions.length > 0 ? projectRegions : ["us"];

// After:
const regionsToEstimate = [proj?.primary_region || "us"];
```

#### 4. Add `startSimulation` to API client

New method on `ImpactcheckClient`:
```typescript
startSimulation(projectId: string): Promise<JobStatus>;
getSimulationEstimates(projectId: string): Promise<ActivityEstimate[]>;
```

The `supabaseAdapter` implements these by invoking the new edge function and reading from `simulation_estimates`.

#### 5. Updated Report Page Flow

```text
User navigates to /report
        |
        v
  Has comparison regions?
   /            \
  No             Yes
  |               |
  v               v
Load report    Check for active simulation job
immediately      |
              Running? --> Show JobProgressCard
              Not found? --> Start simulation job --> Show JobProgressCard
              Succeeded? --> Load report with merged data
```

The Report page will:
- Use `useJobPoller` with `jobType: "simulation"` to track progress.
- Show a `JobProgressCard` component (already exists) while simulations run.
- Once simulation completes, fetch the full report.

#### 6. Updated `getReport` in `supabaseAdapter`

After fetching `estimates` (home region), also fetch `simulation_estimates` and merge them into the same aggregation logic for `totalsByRegion`, `categoryBreakdownByRegion`, `phaseTotalsByRegion`, and `hotspots`.

#### 7. Fix Build Errors

While implementing, also fix the two existing build errors:
- Add `deleteDocument` to `mockAdapter.ts`
- Fix the `"processed"` status comparison in `Upload.tsx` to use `"ready"`

### Files to Create
- `supabase/functions/simulate-regions/index.ts`

### Files to Modify
- `supabase/functions/mapping/index.ts` (restrict to primary region only)
- `supabase/config.toml` (add simulate-regions function config)
- `src/api/impactcheckClient.ts` (add simulation methods)
- `src/api/adapters/supabaseAdapter.ts` (implement simulation methods + merge into getReport)
- `src/api/adapters/mockAdapter.ts` (add missing methods + fix build error)
- `src/pages/Report.tsx` (add simulation trigger + progress UI)
- `src/pages/Upload.tsx` (fix build error)

