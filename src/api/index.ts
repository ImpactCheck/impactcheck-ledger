import { createMockAdapter } from "./adapters/mockAdapter";
import type { ImpactcheckClient } from "./impactcheckClient";

export const api: ImpactcheckClient = createMockAdapter();
