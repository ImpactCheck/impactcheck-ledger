

# Fix: Report Generation Stuck on Loading

## Problem
When navigating to the Report page, the "Building your carbon report..." spinner appears indefinitely. The root cause is in the `getReport` method in the Supabase adapter, which sequentially calls:

1. `getProject(projectId)` -- fast
2. `getEstimates(projectId)` -- fast
3. `getActivities(projectId)` -- fast
4. `getSimulationEstimates(projectId)` -- fast
5. `invokeCompliance(projectId)` -- calls the `compliance` edge function, which makes **sequential Gemini API calls for each region** (primary + all comparison regions). With 3 regions, that's 3 back-to-back Gemini requests, which can easily exceed the edge function timeout (60 seconds).

After `getReport` resolves, it also fires `generateRecommendations(projectId)` which makes another Gemini call.

Additionally, the `compliance` edge function has a bug: its `regionToJurisdiction` function still uses old lowercase region names (`"norway"`, `"iceland"`) but the database now stores ISO codes (`"NO"`, `"IS"`), so jurisdiction detection defaults to "USA" for all regions.

## Solution

### 1. Decouple compliance from report loading
Move the compliance call out of `getReport` so the report renders immediately with core data. Compliance and recommendations load asynchronously in the background.

**File: `src/api/adapters/supabaseAdapter.ts`**
- Remove the `invokeCompliance(projectId)` call from inside `getReport`
- Return a default/empty compliance object from `getReport`

**File: `src/pages/Report.tsx`**
- Load compliance data separately after the report renders (non-blocking)
- Load recommendations separately (already partially done, but tighten error handling)
- Add a timeout fallback so the page never hangs indefinitely

### 2. Fix region code mapping in compliance edge function
**File: `supabase/functions/compliance/index.ts`**
- Update `regionToJurisdiction` to handle ISO codes: `"NO"` maps to Norway, `"IS"` maps to Iceland, `"US"` maps to USA, `"EU"` maps to EU

### 3. Add compliance function to config.toml
The compliance function is missing from `supabase/config.toml`, meaning JWT verification defaults may apply.

**File: `supabase/config.toml`**
- Add `[functions.compliance]` with `verify_jwt = false`

## Technical Details

### Changes to `src/pages/Report.tsx`

```typescript
// Load report data (fast, no Gemini calls)
const loadReport = useCallback(() => {
  if (!projectId) return;
  setLoading(true);
  setError(null);
  api.getReport(projectId)
    .then((r) => {
      setReport(r);
      setLoading(false);
      // Load compliance and recommendations in background
      api.getCompliance(projectId)
        .then((c) => {
          setReport(prev => prev ? { ...prev, compliance: { ...prev.compliance, byRegion: c.byRegion } } : prev);
        })
        .catch(() => {});
      api.generateRecommendations(projectId)
        .then(setRecommendations)
        .catch(() => setRecommendations([]));
    })
    .catch((e) => {
      setError(e.message ?? "Failed to load report");
      setLoading(false);
    });
}, [projectId]);
```

### Changes to `src/api/adapters/supabaseAdapter.ts`

Remove `invokeCompliance` from `getReport` and return static compliance defaults so the report renders immediately.

### Changes to `supabase/functions/compliance/index.ts`

```typescript
function regionToJurisdiction(region: string): "Norway" | "EU" | "USA" | "Iceland" {
  const r = (region || "").toUpperCase();
  if (r === "NO" || r === "NORWAY") return "Norway";
  if (r === "EU") return "EU";
  if (r === "US" || r === "USA") return "USA";
  if (r === "IS" || r === "ICELAND") return "Iceland";
  return "USA";
}
```

### Changes to `supabase/config.toml`

```toml
[functions.compliance]
verify_jwt = false
```

## Summary of Changes
| File | Change |
|------|--------|
| `src/api/adapters/supabaseAdapter.ts` | Remove `invokeCompliance` from `getReport` |
| `src/pages/Report.tsx` | Load compliance asynchronously after report renders |
| `supabase/functions/compliance/index.ts` | Fix ISO region code mapping |
| `supabase/config.toml` | Add compliance function config |

