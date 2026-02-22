import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPro: boolean;
  subscriptionEnd: string | null;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isPro: false,
    subscriptionEnd: null,
  });

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (!error && data) {
        setState((prev) => ({
          ...prev,
          isPro: data.subscribed ?? false,
          subscriptionEnd: data.subscription_end ?? null,
        }));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session,
        loading: false,
      }));
      if (session?.user) {
        setTimeout(() => checkSubscription(), 0);
      } else {
        setState((prev) => ({ ...prev, isPro: false, subscriptionEnd: null }));
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        session,
        loading: false,
      }));
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
