import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingDown, Loader2, Check, Lock, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "@/api";
import type { Recommendation } from "@/contracts/impactcheck.v2";
import { formatTonnes } from "@/contracts/impactcheck.v2";
import { useProject } from "@/contexts/ProjectContext";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Recommendations() {
  const navigate = useNavigate();
  const { project } = useProject();
  const projectId = project.currentProjectId ?? "prj_1";

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalText, setFinalText] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await api.generateRecommendations(projectId);
      setRecs(result);
      setSelectedId(null);
      setFinalized(false);
      setFinalText(null);
    } finally {
      setGenerating(false);
    }
  };

  const updateStrategy = (id: string, text: string) => {
    setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, strategyDraftText: text } : r)));
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const result = await api.finalizeStrategy(projectId, recs.map((r) => r.id));
      setFinalText(result.strategyText);
      setFinalized(true);
      toast.success("Strategy finalized");
    } finally {
      setFinalizing(false);
    }
  };

  const selected = recs.find((r) => r.id === selectedId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recommendations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Actionable strategies to reduce your carbon footprint.</p>
        </div>
        {recs.length === 0 && (
          <Button onClick={handleGenerate} disabled={generating} className="gap-2 rounded-xl">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate Recommendations
          </Button>
        )}
      </div>

      {/* Finalized banner */}
      {finalized && finalText && (
        <Card className="card-elevated border-0 overflow-hidden">
          <div className="bg-gradient-green p-5 text-primary-foreground">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-semibold">Strategy Finalized</span>
            </div>
            <p className="text-sm opacity-90">{finalText}</p>
          </div>
        </Card>
      )}

      {/* Scenario cards + editor */}
      {recs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {recs.map((rec) => (
              <Card
                key={rec.id}
                className={cn(
                  "cursor-pointer transition-all card-elevated border-0",
                  selectedId === rec.id && "ring-2 ring-primary/30 bg-primary/[0.02]",
                  finalized && "opacity-75 cursor-default"
                )}
                onClick={() => !finalized && setSelectedId(rec.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <TrendingDown className="h-3.5 w-3.5 text-primary" />
                      {rec.title}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px] text-primary rounded-full">
                      -{formatTonnes(Math.abs(rec.expectedDeltaKg))} t
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-xs text-muted-foreground">{rec.summary}</p>
                  {rec.constraints && rec.constraints.length > 0 && (
                    <div className="text-[10px] text-muted-foreground/70 mt-1.5">
                      ⚠ {rec.constraints.join("; ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {!finalized && recs.length > 0 && (
              <Button onClick={handleFinalize} disabled={finalizing} className="w-full gap-2 rounded-xl">
                {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Finalize Strategy
              </Button>
            )}
          </div>

          {/* Strategy editor */}
          <div className="lg:col-span-3">
            {selected ? (
              <Card className="card-elevated border-0">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {finalized ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    {selected.title}
                  </CardTitle>
                  <CardDescription>
                    {finalized ? "Strategy is locked." : "Edit the strategy draft below."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="h-7 w-7 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-primary">AI</span>
                      </div>
                      <div className="rounded-xl bg-muted/50 p-3 text-sm flex-1">
                        <p className="text-xs text-muted-foreground mb-1 font-semibold">Generated Strategy</p>
                        <p>{selected.summary}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="h-7 w-7 rounded-xl bg-accent flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-accent-foreground">You</span>
                      </div>
                      <div className="flex-1">
                        <Textarea
                          value={selected.strategyDraftText}
                          onChange={(e) => updateStrategy(selected.id, e.target.value)}
                          disabled={finalized}
                          className="min-h-[120px] text-sm resize-y rounded-xl"
                          placeholder="Edit the strategy draft…"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Expected reduction: <span className="font-mono text-primary font-semibold">{formatTonnes(Math.abs(selected.expectedDeltaKg))} t CO₂e</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="card-elevated border-0">
                <CardContent className="pt-6">
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Select a recommendation to edit its strategy.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate("/report")} className="gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    </div>
  );
}
