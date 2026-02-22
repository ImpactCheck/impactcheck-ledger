

## Benchmarking: Direct Estimates Comparison (No Report)

### Problem
The Benchmarking page currently calls `api.getReport()`, which triggers slow compliance calls and builds a full report object. Benchmarking only needs to compare raw estimate totals across regions -- home region estimates vs simulation estimates for comparison regions.

### Revised Approach

Remove the `getReport` call entirely. Instead:

1. Load home-region estimates from `estimates` table directly (already done via `api.getEstimates`).
2. If comparison regions exist, trigger the simulation job and show progress via `JobProgressCard`.
3. Once simulation completes, load simulation estimates via `api.getSimulationEstimates`.
4. Aggregate totals per region from both datasets and display the benchmarking charts.

### Changes

#### `src/pages/Benchmarking.tsx`

- Remove the `getReport` call and the `report` state entirely.
- Add `useJobPoller` with `jobType: "simulation"` for progress tracking.
- On mount:
  - Load home-region estimates via `api.getEstimates(projectId)`.
  - Check if comparison regions exist (from `project.comparisonRegions`).
  - If yes: check for existing simulation estimates; if empty, trigger `api.startSimulation(projectId)` and show `JobProgressCard`.
  - Once simulation completes, load simulation estimates via `api.getSimulationEstimates(projectId)`.
- Compute all benchmarking metrics (totals per region, intensity, phase splits) directly from the raw estimate arrays instead of relying on a report object.
- Add a new **Region Comparison bar chart** showing total CO2e per region side by side (home vs each comparison region).
- Keep the existing carbon intensity benchmark chart and trajectory chart, but derive data from estimates + activities instead of the report.

#### Data Flow

```text
User navigates to /benchmarking
        |
        v
  Load home estimates (api.getEstimates)
  Load activities (for phase categorization)
        |
        v
  Has comparison regions?
   /            \
  No             Yes
  |               |
  v               v
Show charts    Check for simulation data
with home        |
data only    Has data? -----> Load simulation estimates --> Show charts
              |
              No data --> Start simulation --> Show JobProgressCard
                                                    |
                                              Completed --> Load simulation estimates --> Show charts
```

#### Metrics Derived from Raw Estimates

- **Total CO2e per region**: Sum `co2e_kg` grouped by region from estimates + simulation_estimates.
- **Phase totals** (embodied vs operational): Categorize by looking up each estimate's activity category (same `getActivityPhase` logic).
- **Carbon intensity**: Total CO2e / activity count per region.
- **Region comparison chart**: New horizontal bar chart with one bar per region (home + comparison regions).

#### New Chart: Region Comparison

A new bar chart comparing total emissions across all regions. Each bar represents a region, colored distinctly. The home region is highlighted. This replaces the need for report-level `totalsByRegion`.

### Files to Modify

- `src/pages/Benchmarking.tsx` -- Full rework: remove `getReport`, add simulation trigger + progress, compute metrics from raw estimates, add region comparison chart.

### No Other Files Changed

The API client already has `getEstimates`, `getSimulationEstimates`, and `startSimulation`. The `JobProgressCard` component already supports the "simulation" job type. No backend changes needed.

