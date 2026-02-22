import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/logo.png";
import {
  ArrowRight, Shield, Zap, DollarSign, Sun, Moon,
  Building2, Scale, TrendingDown, FileCheck, Clock,
  ChevronRight, Leaf, BarChart3, CheckCircle2, Users,
  Globe, Eye, Check, LogOut, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TIERS, type SubscriptionTier } from "@/lib/subscription-tiers";
const AUDIENCES = [
  {
    icon: Building2,
    label: "Investors & VCs",
    headline: "Independent due diligence you can trust",
    description:
      "Know from a third-party, standardized source whether a portfolio company's sustainability claims hold up — before you commit capital.",
  },
  {
    icon: Scale,
    label: "Regulators",
    headline: "Verify with transparent methodology",
    description:
      "Cross-check reported emissions against reproducible, open-method calculations. Every number links back to its emission factor and data source.",
  },
  {
    icon: TrendingDown,
    label: "Companies",
    headline: "Understand your footprint, reduce it",
    description:
      "Get a clear picture of how much your project will emit — and actionable recommendations to cut emissions before breaking ground.",
  },
];

const DIFFERENTIATORS = [
  {
    icon: Zap,
    title: "10× faster than consultants",
    description:
      "Upload your procurement data and get a full lifecycle carbon report in minutes, not months. AI extracts activities and maps emission factors automatically.",
  },
  {
    icon: Eye,
    title: "Fully transparent & verifiable",
    description:
      "Every calculation traces back to standardized emission factors (Climatiq, IPCC). No black boxes — auditors and regulators can inspect every step.",
  },
  {
    icon: DollarSign,
    title: "Fraction of the cost",
    description:
      "Traditional carbon audits cost €30k–€100k+. ImpactCheck delivers comparable rigor at a fraction of the price, making compliance accessible to all.",
  },
  {
    icon: Shield,
    title: "CSRD-ready reporting",
    description:
      "Built for the EU Corporate Sustainability Reporting Directive. Generate audit-grade reports that satisfy regulatory requirements out of the box.",
  },
];

const STEPS = [
  { num: "01", title: "Upload documents", description: "Drop your procurement data — PDF, CSV, XLSX, or JSON." },
  { num: "02", title: "AI extraction", description: "Our AI reads every line item and classifies embodied (Year 1 only) vs. operational (recurring annual) activities." },
  { num: "03", title: "Emission mapping", description: "Each activity is matched to verified emission factors from global databases." },
  { num: "04", title: "Full report", description: "Download a lifecycle carbon report with regional comparisons and reduction recommendations." },
];

const TRUST_POINTS = [
  { icon: FileCheck, text: "Standardized emission factors (Climatiq, IPCC)" },
  { icon: Globe, text: "Multi-region comparison (ERCOT, PJM, Nordic, APAC)" },
  { icon: Users, text: "Third-party independent assessment" },
  { icon: CheckCircle2, text: "Audit-grade documentation trail" },
];

const PRICING_TIERS: { key: SubscriptionTier; popular?: boolean }[] = [
  { key: "free" },
  { key: "company" },
  { key: "investor", popular: true },
  { key: "regulator" },
];

export default function Landing() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const goToDemo = () => {
    sessionStorage.setItem("demoMode", "1");
    navigate("/app");
  };
  const goToAuth = () => navigate("/auth");

  const handleCheckout = async (tier: SubscriptionTier) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { tier },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Navbar ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="ImpactCheck" className="h-9 w-9 object-contain" />
            <span className="text-base font-bold tracking-tight">ImpactCheck</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>
            {user ? (
              <div className="flex items-center gap-2">
                <Button onClick={goToDemo} size="sm" className="gap-1.5 rounded-xl h-9 px-5 shadow-sm">
                  Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button onClick={signOut} variant="ghost" size="sm" className="rounded-xl h-9 px-3">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button onClick={goToAuth} variant="ghost" size="sm" className="rounded-xl h-9 px-4">
                  Sign In
                </Button>
                <Button onClick={goToDemo} size="sm" className="gap-1.5 rounded-xl h-9 px-5 shadow-sm">
                  Free Demo <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-mesh-green">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] rounded-full bg-primary/[0.06] blur-3xl" />
          <div className="absolute bottom-[-20%] right-[10%] w-[400px] h-[400px] rounded-full bg-primary/[0.04] blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-primary/20">
            <Leaf className="h-3.5 w-3.5" />
            CSRD & ESG Compliance
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] max-w-3xl mx-auto mb-6">
            Carbon audits for AI infrastructure,{" "}
            <span className="text-gradient-green">in minutes — not months</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            Independent, third-party lifecycle carbon assessment. Upload procurement documents,
            get a standardized report — transparent, verifiable, and CSRD-ready.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={goToDemo}
              size="lg"
              className="gap-2 rounded-2xl h-13 px-10 text-base shadow-lg shadow-primary/25 glow-green"
            >
              Try Free Demo <ArrowRight className="h-5 w-5" />
            </Button>
            <a
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              See pricing <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {TRUST_POINTS.map((tp) => (
              <div key={tp.text} className="flex items-center gap-2 text-xs text-muted-foreground">
                <tp.icon className="h-4 w-4 text-primary/70" />
                <span>{tp.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="step-number mb-2">Who it's for</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Built for every stakeholder in the carbon value chain
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Whether you're investing, regulating, or building — ImpactCheck gives you the
              independent data you need to make informed decisions.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {AUDIENCES.map((a) => (
              <Card key={a.label} className="card-elevated border-0 rounded-3xl hover-lift group">
                <CardContent className="p-7">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                    <a.icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 font-mono">
                    {a.label}
                  </p>
                  <h3 className="text-lg font-bold mb-2 leading-snug">{a.headline}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Differentiators ──────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="step-number mb-2">Why ImpactCheck</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Faster, cheaper, fully transparent
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Traditional carbon consulting is slow, expensive, and opaque.
              We built something better.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {DIFFERENTIATORS.map((d) => (
              <Card key={d.title} className="card-elevated border-0 rounded-3xl">
                <CardContent className="p-7 flex gap-5">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <d.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1.5">{d.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{d.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="step-number mb-2">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              From raw documents to audit-ready report
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Four steps. Fully automated. Verifiable at every stage.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, idx) => (
              <div key={s.num} className="relative">
                {idx < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+40px)] right-[-24px] h-px bg-border" aria-hidden />
                )}
                <Card className="card-elevated border-0 rounded-3xl h-full">
                  <CardContent className="p-7">
                    <span className="text-3xl font-extrabold text-primary/20 font-mono">{s.num}</span>
                    <h3 className="font-bold mt-3 mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="step-number mb-2">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Start free, scale when ready
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Choose the plan that fits your role. All paid plans include per-seat pricing.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_TIERS.map(({ key, popular }) => {
              const tier = TIERS[key];
              const isPaid = tier.price > 0;
              return (
                <Card
                  key={key}
                  className={cn(
                    "card-elevated border-0 rounded-3xl relative overflow-hidden",
                    popular && "border-glow"
                  )}
                >
                  {popular && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-green" />}
                  <CardContent className="p-7">
                    <div className="flex items-center gap-2 mb-2">
                      <p className={cn(
                        "text-[10px] font-bold uppercase tracking-widest font-mono",
                        popular ? "text-primary" : "text-muted-foreground"
                      )}>
                        {tier.label}
                      </p>
                      {popular && (
                        <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-extrabold">${tier.price}</span>
                      <span className="text-muted-foreground text-sm">/mo{isPaid ? " per seat" : ""}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-5">{tier.description}</p>
                    <ul className="space-y-2 mb-6">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    {tier.overflow && (
                      <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 mb-4 text-[11px] text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                        <span>{tier.overflow}</span>
                      </div>
                    )}
                    {isPaid ? (
                      <Button
                        onClick={() => handleCheckout(key)}
                        className={cn("w-full rounded-xl h-10", popular && "glow-green")}
                      >
                        Subscribe
                      </Button>
                    ) : (
                      <Button onClick={goToDemo} variant="outline" className="w-full rounded-xl h-10">
                        Get Started Free
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CSRD callout ─────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-warning/10 text-warning text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-warning/20">
            <Clock className="h-3.5 w-3.5" />
            Regulatory Deadline
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
            The EU CSRD is here. Are you ready?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8 text-lg">
            The Corporate Sustainability Reporting Directive requires companies to disclose
            detailed environmental impact data — including Scope 1, 2, and 3 emissions.
            ImpactCheck generates compliant reports automatically, so you stay ahead of deadlines.
          </p>
          <Button
            onClick={goToDemo}
            size="lg"
            className="gap-2 rounded-2xl h-13 px-10 text-base shadow-lg shadow-primary/25"
          >
            Start Your Free Assessment <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="step-number mb-2">Comparison</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              ImpactCheck vs. traditional consulting
            </h2>
          </div>

          <Card className="card-elevated border-0 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-5 text-muted-foreground font-medium" />
                    <th className="text-center p-5 font-bold text-primary">ImpactCheck</th>
                    <th className="text-center p-5 font-medium text-muted-foreground">Traditional Consultant</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Turnaround time", "Minutes", "3–6 months"],
                    ["Cost", "From $0 (free tier)", "€30k – €100k+"],
                    ["Methodology", "Open, standardized", "Proprietary, varies"],
                    ["Reproducibility", "100% reproducible", "Analyst-dependent"],
                    ["Multi-region comparison", "Built-in", "Extra engagement"],
                    ["CSRD compliance", "Automatic", "Manual formatting"],
                  ].map(([label, ic, trad], idx) => (
                    <tr key={label} className={cn(idx % 2 === 0 && "bg-muted/30")}>
                      <td className="p-5 font-medium">{label}</td>
                      <td className="p-5 text-center font-semibold text-primary">{ic}</td>
                      <td className="p-5 text-center text-muted-foreground">{trad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <Card className="border-0 rounded-3xl overflow-hidden relative">
            <div className="bg-gradient-green p-10 md:p-16 text-center relative overflow-hidden">
              <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-primary-foreground/10" aria-hidden />
              <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-primary-foreground/5" aria-hidden />

              <div className="relative">
                <div className="h-16 w-16 rounded-3xl bg-primary-foreground/15 flex items-center justify-center mx-auto mb-6">
                  <BarChart3 className="h-8 w-8 text-primary-foreground" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground tracking-tight mb-4">
                  Ready to audit your carbon footprint?
                </h2>
                <p className="text-primary-foreground/80 max-w-lg mx-auto mb-8 text-lg">
                  Try ImpactCheck for free — no credit card required. Upload your data and get results in minutes.
                </p>
                <Button
                  onClick={goToDemo}
                  size="lg"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2 rounded-2xl h-13 px-10 text-base shadow-lg"
                >
                  Launch Free Demo <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="ImpactCheck" className="h-7 w-7 object-contain" />
            <span className="text-sm font-semibold">ImpactCheck</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ImpactCheck. Standardized emission factors via Climatiq & IPCC.
          </p>
        </div>
      </footer>
    </div>
  );
}
