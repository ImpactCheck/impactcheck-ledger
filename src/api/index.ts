import { createSupabaseAdapter } from "./adapters/supabaseAdapter";
import type { ImpactcheckClient } from "./impactcheckClient";

export const api: ImpactcheckClient = createSupabaseAdapter();
