import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { tierFromProductId, type SubscriptionTier } from "@/lib/subscription-tiers";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPro: boolean;
  subscriptionTier: SubscriptionTier;
  subscriptionEnd: string | null;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

const DEMO_TIER: SubscriptionTier = "regulator";

function getEffectiveTier(
  session: Session | null,
  subscribed: boolean,
  tier: SubscriptionTier,
  subscriptionEnd: string | null
): SubscriptionTier {
  if (session?.user) {
    return subscribed ? tier : "free";
  }
  if (typeof window !== "undefined" && sessionStorage.getItem("demoMode") === "1") {
    return DEMO_TIER;
  }
  return "free";
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isPro: false,
    subscriptionTier: "free",
    subscriptionEnd: null,
  });

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (!error && data) {
        const tier = tierFromProductId(data.product_id);
        const subscribed = data.subscribed ?? false;
        const subscriptionEnd = data.subscription_end ?? null;
        setState((prev) => {
          const effectiveTier = getEffectiveTier(prev.session, subscribed, tier, subscriptionEnd);
          const isDemo = !prev.session?.user && effectiveTier === DEMO_TIER;
          return {
            ...prev,
            isPro: subscribed || isDemo,
            subscriptionTier: effectiveTier,
            subscriptionEnd,
          };
        });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((prev) => {
        const next = {
          ...prev,
          user: session?.user ?? null,
          session,
          loading: false,
        };
        if (session?.user) {
          return next;
        }
        const isDemo = typeof window !== "undefined" && sessionStorage.getItem("demoMode") === "1";
        return {
          ...next,
          isPro: isDemo,
          subscriptionTier: isDemo ? DEMO_TIER : "free",
          subscriptionEnd: null,
        };
      });
      if (session?.user) {
        setTimeout(() => checkSubscription(), 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((prev) => {
        const next = {
          ...prev,
          user: session?.user ?? null,
          session,
          loading: false,
        };
        if (session?.user) {
          return next;
        }
        const isDemo = typeof window !== "undefined" && sessionStorage.getItem("demoMode") === "1";
        return {
          ...next,
          isPro: isDemo,
          subscriptionTier: isDemo ? DEMO_TIER : "free",
          subscriptionEnd: null,
        };
      });
      if (session?.user) checkSubscription();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Refresh subscription every 60s
  useEffect(() => {
    if (!state.user) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [state.user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ ...state, signOut, checkSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
