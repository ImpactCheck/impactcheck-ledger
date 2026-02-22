## Remove Deployment / Crusoe Feature

This plan removes the entire Deploy / Crusoe integration from the application, including the UI page, API methods, edge function, sidebar step, and setup checkbox.

### Changes

**1. Delete files**

- `src/pages/Deploy.tsx` -- the deploy page
- `supabase/functions/deploy-crusoe/index.ts` -- the edge function

**2. `src/App.tsx**` -- Remove the Deploy route and import

**3. `src/layouts/DashboardLayout.tsx**` -- Remove the Deploy step from the sidebar `STEPS` array and the `deployOnly` filtering logic

**4. `src/contexts/ProjectContext.tsx**` -- Remove `deployOptIn` from `ProjectConfig` interface and default state

**5. `src/pages/Setup.tsx**` -- Remove the "Help with implementation" checkbox section and the `Checkbox` import

**6. `src/pages/Recommendations.tsx**` -- Remove the conditional "Continue to Deploy" button and related `deployOptIn` logic

**7. `src/hooks/useStepCompletion.ts**` -- Remove `deploy` from the `StepCompletion` interface and initial/computed state

**8. `src/api/impactcheckClient.ts**` -- Remove `deployCrusoe` and `getDeploymentStatus` from the API interface; remove `DeploymentPlan` import

**9. `src/api/adapters/supabaseAdapter.ts**` -- Remove the deploy methods and `DeploymentPlan` import

**10. `src/api/adapters/mockAdapter.ts**` -- Remove the deploy methods and `DeploymentPlan` import

**11. `src/contracts/impactcheck.v2.ts**` -- Remove the `DeploymentPlan` interface

**12. Delete deployed edge function** -- Remove `deploy-crusoe` from the deployed backend functions

### Technical Details

- The `Rocket` icon import in `DashboardLayout.tsx` will also be removed since no step uses it
- The `Dashboard.tsx` "Deploy-ready" label on the AI infra card can be changed to just show the count without that label
- Also remove any Python related deploy files that are part of the implementation logic for the deployment aspect