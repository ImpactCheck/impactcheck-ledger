import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatJob(j: any) {
  return {
    id: j.id,
    type: j.type,
    status: j.status,
    progress: j.progress,
    stage: j.stage,
    message: j.message,
    createdAt: j.created_at,
    updatedAt: j.updated_at,
  };
}

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

    // Finalize action — synchronous, no job needed
    if (action === "finalize") {
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

    // Generate recommendations — job-based, async
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({
        project_id: projectId,
        type: "recommendations",
        status: "running",
        progress: 5,
        stage: "loading_data",
      })
      .select()
      .single();
    if (jobErr) throw jobErr;

    const work = runRecommendations(job.id, projectId, supabase, GEMINI_API_KEY);
    // @ts-ignore — EdgeRuntime.waitUntil keeps the function alive after the response is sent.
    if (typeof EdgeRuntime !== "undefined") {
      EdgeRuntime.waitUntil(work);
    } else {
      work.catch((e) => console.error("Background recommendations error:", e));
    }

    return new Response(JSON.stringify(formatJob(job)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommendations error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function runRecommendations(
  jobId: string,
  projectId: string,
  supabase: ReturnType<typeof createClient>,
  GEMINI_API_KEY: string
): Promise<void> {
  try {
    // Load data
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

    if (!estimates || estimates.length === 0) {
      await supabase.from("jobs").update({
        status: "failed",
        message: "No estimates found. Run mapping first.",
        progress: 100,
        stage: "done",
      }).eq("id", jobId);
      return;
    }

    await supabase.from("jobs").update({
      progress: 20,
      stage: "analyzing_hotspots",
      message: `Analyzing ${estimates.length} emission hotspots…`,
    }).eq("id", jobId);

    const hotspotSummary = estimates.map((e: any) => {
      const actText = e.activities?.text || "Unknown";
      return `- ${actText}: ${e.co2e_kg?.toLocaleString()} kg CO₂e (${e.matched_factor?.name || "unknown factor"})`;
    }).join("\n");

    await supabase.from("jobs").update({
      progress: 40,
      stage: "generating_strategies",
      message: "Generating reduction strategies with AI…",
    }).eq("id", jobId);

    const companyType = project?.company_type || "business";
    const region = project?.primary_region || "unknown region";

    let roleContext = "";
    let outputGuidance = "";

    if (companyType === "investor") {
      roleContext = `You are a carbon investment analyst advising venture capital and institutional investors. Your focus is on long-term feasibility, cost-to-carbon ROI, and financial risks from non-compliance (e.g. carbon taxes, fines, stranded assets).`;
      outputGuidance = `For each recommendation:
- Emphasize cost/carbon impact and ROI projections
- If the project is not compliant, estimate potential fees, penalties, or carbon taxes the company would face
- Assess long-term investment feasibility given the carbon profile
- Highlight risks that could affect portfolio value
- Frame recommendations in terms of financial returns alongside emission reductions`;
    } else if (companyType === "regulator") {
      roleContext = `You are a regulatory compliance advisor specializing in environmental policy (CSRD, EU ETS, EPA regulations). Your focus is on helping projects achieve and maintain long-term regulatory compliance.`;
      outputGuidance = `For each recommendation:
- If the project is already compliant, recommend strategies to maintain compliance long-term as regulations tighten
- If not compliant, provide a clear roadmap to achieve compliance with specific milestones
- Reference relevant regulatory frameworks (CSRD, EU ETS, national carbon budgets)
- Estimate timeline and effort for each compliance improvement
- Highlight evidence gaps that could be flagged during audits`;
    } else {
      roleContext = `You are a carbon reduction strategy consultant. Your focus is on actionable emission reduction strategies with practical implementation guidance.`;
      outputGuidance = `For each recommendation:
- Provide concrete, actionable steps the company can take
- Estimate the emission reduction potential
- Consider operational constraints and implementation feasibility
- Prioritize highest-impact changes`;
    }

    const prompt = `${roleContext}

Based on the following emission hotspots for a project in ${region}, generate 3-5 targeted recommendations.

Hotspots:
${hotspotSummary}

${outputGuidance}

For each recommendation return a JSON array with:
- title: short title
- summary: 1-2 sentence description
- expectedDeltaKg: negative number representing expected reduction in kg CO₂e
- constraints: array of constraint strings
- strategyDraftText: detailed strategy text (3-5 sentences)

Return ONLY valid JSON array, no markdown fences.`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
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
      await supabase.from("jobs").update({
        status: "failed",
        message: "AI recommendation generation failed",
        progress: 100,
        stage: "done",
      }).eq("id", jobId);
      return;
    }

    await supabase.from("jobs").update({
      progress: 70,
      stage: "parsing_results",
      message: "Parsing AI-generated strategies…",
    }).eq("id", jobId);

    const geminiData = await geminiResp.json();
    let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    rawText = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: any[];
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Try to extract JSON array
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          parsed = JSON.parse(match[0].replace(/,\s*([}\]])/g, "$1"));
        } catch {
          console.error("Failed to parse Gemini response:", rawText.slice(0, 500));
          parsed = [];
        }
      } else {
        console.error("No JSON array found in Gemini response:", rawText.slice(0, 500));
        parsed = [];
      }
    }

    if (parsed.length === 0) {
      await supabase.from("jobs").update({
        status: "failed",
        message: "AI returned no recommendations. Try again.",
        progress: 100,
        stage: "done",
      }).eq("id", jobId);
      return;
    }

    await supabase.from("jobs").update({
      progress: 85,
      stage: "saving",
      message: `Saving ${parsed.length} reduction strategies…`,
    }).eq("id", jobId);

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

    await supabase.from("recommendations").insert(rows);

    await supabase.from("jobs").update({
      status: "succeeded",
      progress: 100,
      stage: "done",
      message: `Generated ${parsed.length} reduction strategies`,
    }).eq("id", jobId);
  } catch (e) {
    console.error("runRecommendations error:", e);
    await supabase.from("jobs").update({
      status: "failed",
      progress: 100,
      stage: "done",
      message: e instanceof Error ? e.message : "Recommendation generation failed",
    }).eq("id", jobId).catch(() => {});
  }
}
