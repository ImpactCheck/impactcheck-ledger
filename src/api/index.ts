import { createSupabaseAdapter } from "./adapters/supabaseAdapter";
import { createMockAdapter } from "./adapters/mockAdapter";
import type { ImpactcheckClient } from "./impactcheckClient";
import { supabase } from "@/integrations/supabase/client";

// Start with mock adapter (safe default for anonymous users)
let currentAdapter: ImpactcheckClient = createMockAdapter();
let isLoggedIn = false;

// Listen for auth changes and swap adapter
supabase.auth.onAuthStateChange((_event, session) => {
  const loggedIn = !!session?.user;
  if (loggedIn !== isLoggedIn) {
    isLoggedIn = loggedIn;
    currentAdapter = loggedIn ? createSupabaseAdapter() : createMockAdapter();
  }
});

// Also check initial session (covers page reload while logged in)
supabase.auth.getSession().then(({ data: { session } }) => {
  const loggedIn = !!session?.user;
  if (loggedIn !== isLoggedIn) {
    isLoggedIn = loggedIn;
    currentAdapter = loggedIn ? createSupabaseAdapter() : createMockAdapter();
  }
});

// Proxy that always delegates to the current adapter
export const api: ImpactcheckClient = new Proxy({} as ImpactcheckClient, {
  get(_target, prop: string) {
    return (...args: any[]) => (currentAdapter as any)[prop](...args);
  },
});
