import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectId, action, recommendationIds } = await req.json();
    if (!projectId) throw new Error("projectId required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "finalize") {
      // Finalize strategy
      const { data: recs } = await supabase
        .from("recommendations")
        .select("*")
        .eq("project_id", projectId)
        .in("id", recommendationIds || []);

      const totalDelta = (recs || []).reduce((s: number, r: any) => s + (r.expected_delta_kg || 0), 0);
      const strategyText = `Finalized strategy incorporating ${(recs || []).length} recommendations. Total projected reduction: ${Math.abs(totalDelta).toLocaleString()} kg CO₂e.`;

      return new Response(JSON.stringify({ strategyText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate recommendations
    const { data: estimates } = await supabase
      .from("estimates")
      .select("*, activities:activity_id(text, unit_type, quantity, unit)")
      .eq("project_id", projectId)
      .order("co2e_kg", { ascending: false })
      .limit(20);

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    const hotspotSummary = (estimates || []).map((e: any) => {
      const actText = e.activities?.text || "Unknown";
      return `- ${actText}: ${e.co2e_kg?.toLocaleString()} kg CO₂e (${e.matched_factor?.name || "unknown factor"})`;
    }).join("\n");

    const prompt = `You are a carbon reduction strategy consultant. Based on the following emission hotspots for a ${project?.company_type || "general"} project in ${project?.primary_region || "unknown region"}, generate 3-5 actionable reduction recommendations.

Hotspots:
${hotspotSummary}

For each recommendation return a JSON array with:
- title: short title
- summary: 1-2 sentence description
- expectedDeltaKg: negative number representing expected reduction in kg CO₂e
- constraints: array of constraint strings
- strategyDraftText: detailed strategy text (2-3 sentences)

Return ONLY valid JSON array, no markdown fences.`;

    // Use Lovable AI Gateway with retry
    const callAI = async (attempt = 0): Promise<string> => {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a carbon reduction strategy consultant. Return ONLY valid JSON arrays, no markdown fences." },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 4096,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`AI gateway error (attempt ${attempt}):`, resp.status, errText);
        if ((resp.status === 503 || resp.status === 429) && attempt < 2) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          return callAI(attempt + 1);
        }
        throw new Error("AI recommendation generation failed");
      }

      const data = await resp.json();
      return data.choices?.[0]?.message?.content ?? "[]";
    };

    let rawText = await callAI();

    rawText = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: any[];
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse Gemini response:", rawText.slice(0, 500));
      parsed = [];
    }

    // Delete old recommendations
    await supabase.from("recommendations").delete().eq("project_id", projectId);

    // Insert new
    const rows = parsed.map((r: any) => ({
      project_id: projectId,
      title: r.title || "Untitled",
      summary: r.summary || "",
      expected_delta_kg: r.expectedDeltaKg || 0,
      constraints: r.constraints || [],
      strategy_draft_text: r.strategyDraftText || "",
    }));

    const { data: inserted } = await supabase.from("recommendations").insert(rows).select();

    const result = (inserted || []).map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      summary: r.summary,
      expectedDeltaKg: r.expected_delta_kg,
      constraints: r.constraints,
      strategyDraftText: r.strategy_draft_text,
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommendations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
