import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import logoImg from "@/assets/logo.png";
import { Sun, Moon, ArrowLeft, Mail, Lock, User } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "Password reset link sent." });
        setMode("login");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "Confirm your account to continue." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/app");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast({ title: "Error", description: String(error), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
      </button>

      <Card className="w-full max-w-md card-elevated border-0 rounded-3xl">
        <CardContent className="p-8">
          <div className="flex flex-col items-center mb-8">
            <img src={logoImg} alt="ImpactCheck" className="h-12 w-12 mb-3" />
            <h1 className="text-xl font-bold tracking-tight">
              {mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login" ? "Sign in to your account" : mode === "signup" ? "Start your carbon audit journey" : "Enter your email to reset"}
            </p>
          </div>

          {mode !== "forgot" && (
            <>
              <Button
                variant="outline"
                className="w-full gap-2 rounded-xl mb-4 h-11"
                onClick={handleGoogleSignIn}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </Button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
              </div>
            </>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === "signup" && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 rounded-xl h-11" />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10 rounded-xl h-11" />
            </div>
            {mode !== "forgot" && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pl-10 rounded-xl h-11" />
              </div>
            )}
            <Button type="submit" className="w-full rounded-xl h-11 glow-green" disabled={loading}>
              {loading ? "Loading…" : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm space-y-2">
            {mode === "login" && (
              <>
                <button onClick={() => setMode("forgot")} className="text-primary hover:underline cursor-pointer block mx-auto">Forgot password?</button>
                <p className="text-muted-foreground">Don't have an account? <button onClick={() => setMode("signup")} className="text-primary hover:underline cursor-pointer">Sign up</button></p>
              </>
            )}
            {mode === "signup" && (
              <p className="text-muted-foreground">Already have an account? <button onClick={() => setMode("login")} className="text-primary hover:underline cursor-pointer">Sign in</button></p>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("login")} className="text-primary hover:underline cursor-pointer flex items-center gap-1 mx-auto"><ArrowLeft className="h-3 w-3" /> Back to login</button>
            )}
          </div>

          <div className="mt-6 text-center">
            <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">← Back to home</button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
