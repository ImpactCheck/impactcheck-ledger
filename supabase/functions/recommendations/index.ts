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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

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

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini error:", errText);
      throw new Error("AI recommendation generation failed");
    }

    const geminiData = await geminiResp.json();
    let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
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
