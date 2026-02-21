import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectId } = await req.json();
    if (!projectId) throw new Error("projectId required");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({ project_id: projectId, type: "extract", status: "running", progress: 10, stage: "initializing" })
      .select()
      .single();
    if (jobErr) throw jobErr;

    // Get documents for this project
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .eq("project_id", projectId);

    if (!docs || docs.length === 0) {
      await supabase.from("jobs").update({ status: "failed", message: "No documents found", progress: 100 }).eq("id", job.id);
      return new Response(JSON.stringify(job), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("jobs").update({ progress: 20, stage: "processing" }).eq("id", job.id);

    // Download document contents for extraction
    const docTexts: string[] = [];
    for (const doc of docs) {
      if (doc.storage_path) {
        const { data: fileData } = await supabase.storage.from("documents").download(doc.storage_path);
        if (fileData) {
          const text = await fileData.text();
          docTexts.push(`--- File: ${doc.filename} ---\n${text.slice(0, 15000)}`);
        }
      } else {
        docTexts.push(`--- File: ${doc.filename} (no content available) ---`);
      }
    }

    await supabase.from("jobs").update({ progress: 40, stage: "extracting with AI" }).eq("id", job.id);

    // Call Gemini to extract activities
    const prompt = `You are a carbon emissions analyst. Extract all emission-producing activities from the following documents.

For each activity, return a JSON array of objects with these fields:
- text: description of the activity
- unit_type: one of "Money", "Weight", "Energy", "Distance", "Unknown"
- quantity: numeric quantity if mentioned
- unit: unit of measurement (e.g., "MWh", "MT", "USD", "km")
- amount: monetary amount if applicable
- currency: currency code if applicable
- note: any additional context

Return ONLY valid JSON array, no markdown fences.

Documents:
${docTexts.join("\n\n")}`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini error:", errText);
      await supabase.from("jobs").update({ status: "failed", message: "AI extraction failed", progress: 100 }).eq("id", job.id);
      return new Response(JSON.stringify({ ...job, status: "failed", message: "AI extraction failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResp.json();
    let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    
    // Clean markdown fences if present
    rawText = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let extractedActivities: any[];
    try {
      extractedActivities = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse Gemini response:", rawText.slice(0, 500));
      extractedActivities = [];
    }

    await supabase.from("jobs").update({ progress: 70, stage: "saving activities" }).eq("id", job.id);

    // Delete old activities for this project
    await supabase.from("activities").delete().eq("project_id", projectId);

    // Get project region
    const { data: proj } = await supabase.from("projects").select("primary_region").eq("id", projectId).single();

    // Insert new activities
    if (extractedActivities.length > 0) {
      const rows = extractedActivities.map((a: any) => ({
        project_id: projectId,
        text: a.text || "Unknown activity",
        unit_type: a.unit_type || null,
        region: proj?.primary_region || null,
        quantity: a.quantity || null,
        unit: a.unit || null,
        amount: a.amount || null,
        currency: a.currency || null,
        source_document_id: null,
        note: a.note || null,
      }));
      await supabase.from("activities").insert(rows);
    }

    await supabase.from("jobs").update({
      status: "succeeded",
      progress: 100,
      stage: "complete",
      message: `Extracted ${extractedActivities.length} activities`,
    }).eq("id", job.id);

    const { data: updatedJob } = await supabase.from("jobs").select("*").eq("id", job.id).single();

    return new Response(JSON.stringify(formatJob(updatedJob)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
