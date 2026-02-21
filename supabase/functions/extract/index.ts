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

    // Create the job and return it immediately so the frontend can start polling.
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({ project_id: projectId, type: "extract", status: "running", progress: 5, stage: "reading_files" })
      .select()
      .single();
    if (jobErr) throw jobErr;

    // Run extraction in the background so we can return the job ID now.
    const work = runExtraction(job.id, projectId, supabase, GEMINI_API_KEY);
    // @ts-ignore — EdgeRuntime.waitUntil keeps the function alive after the response is sent.
    if (typeof EdgeRuntime !== "undefined") {
      EdgeRuntime.waitUntil(work);
    } else {
      // Local dev fallback: process synchronously (response is already built below).
      work.catch((e) => console.error("Background extraction error:", e));
    }

    return new Response(JSON.stringify(formatJob(job)), {
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

async function runExtraction(
  jobId: string,
  projectId: string,
  supabase: ReturnType<typeof createClient>,
  GEMINI_API_KEY: string,
): Promise<void> {
  try {
    // Get documents for this project
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .eq("project_id", projectId);

    if (!docs || docs.length === 0) {
      await supabase.from("jobs").update({ status: "failed", message: "No documents found", progress: 100, stage: "done" }).eq("id", jobId);
      return;
    }

    await supabase.from("jobs").update({ progress: 15, stage: "reading_files", message: `Reading ${docs.length} document(s)…` }).eq("id", jobId);

    // Download document contents — PDFs as base64 inline data, text files as text
    const geminiParts: any[] = [];
    const docIdMap: { docId: string; filename: string }[] = [];

    for (const doc of docs) {
      if (!doc.storage_path) continue;
      const { data: fileData } = await supabase.storage.from("documents").download(doc.storage_path);
      if (!fileData) continue;

      const idx = docIdMap.length;
      docIdMap.push({ docId: doc.id, filename: doc.filename });
      const ext = (doc.file_type || doc.filename.split(".").pop() || "").toLowerCase();

      if (ext === "pdf") {
        // Send PDF as base64 inline data so Gemini can parse it natively
        const arrayBuf = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        geminiParts.push({ inlineData: { mimeType: "application/pdf", data: b64 } });
        geminiParts.push({ text: `[Document ${idx}: ${doc.filename}]` });
      } else {
        // Text-based: CSV, JSON, TXT, etc.
        const text = await fileData.text();
        geminiParts.push({ text: `[Document ${idx}: ${doc.filename}]\n${text.slice(0, 30000)}` });
      }
    }

    if (geminiParts.length === 0) {
      await supabase.from("jobs").update({ status: "failed", message: "Could not read any documents", progress: 100, stage: "done" }).eq("id", jobId);
      return;
    }

    await supabase.from("jobs").update({ progress: 30, stage: "extracting", message: "Sending documents to Gemini…" }).eq("id", jobId);

    // Append the extraction prompt after the document parts so Gemini reads docs first
    const extractionPrompt = `You are a carbon emissions data extraction specialist. Your job is to extract emission-producing activities from documents and prepare them for the Climatiq emissions database Search API.

CRITICAL RULES FOR search_query:
The Climatiq Search API uses fuzzy text matching against emission factor names. Long verbose strings perform POORLY. Each search_query MUST be 2-5 generic material/activity keywords.

TRANSFORMATION RULES:
- Brand names → generic material: "NVIDIA GB200" → "computer servers", "Vertiv Liebert XDU" → "cooling equipment", "Caterpillar C175" → "diesel generator", "Tesla Megapack" → "battery lithium ion"
- Specific grades → generic: "Portland cement CEM I 42.5N" → "cement", "C30/37 structural mix" → "concrete", "Grade 60 rebar" → "steel rebar", "6061-T6 aluminum" → "aluminum sheet"
- Energy → Climatiq style: "Electricity from grid" → "electricity supply grid", "Gas boiler" → "natural gas combustion", "Backup diesel gensets" → "diesel fuel combustion", "Solar PV" → "solar photovoltaic"
- Transport → Climatiq style: "Container shipping" → "freight sea shipping", "Trucking" → "freight road truck", "Air cargo" → "freight air transport"
- Strip jargon, project codes, phase numbers, adjectives like "sustainable" or "low-carbon"

UNIT TYPE - must be EXACTLY one of these Climatiq values (case-sensitive) or null:
Weight, Energy, Power, Volume, Area, Distance, Money, Number, Data, Time, WeightOverDistance, ContainerOverDistance, PassengerOverDistance, AreaOverTime, DataOverTime, DistanceOverTime, NumberOverTime, WeightOverTime

UNIT TYPE INFERENCE:
- kg, t, ton, lb, g → "Weight"
- kWh, MWh, GWh, MJ, GJ, TJ → "Energy"
- W, kW, MW → "Power"
- l, L, m3, gallon → "Volume"
- m2, km2, ft2 → "Area"
- km, mi → "Distance"
- $, €, £, USD, EUR, GBP → "Money"
- MB, GB, TB → "Data"
- units, pieces, count → "Number"

CATEGORY - one of: HARDWARE, CONSTRUCTION, ENERGY, TRANSPORT, OPERATIONS, PROCUREMENT, WASTE, WATER, OTHER

IMPORTANT: If a line item has BOTH a physical quantity AND a monetary value, create TWO separate rows:
- Row 1: unit_type = physical type, quantity = physical amount, unit = physical unit
- Row 2: unit_type = "Money", quantity = spend amount, unit = currency code (e.g. "usd")

Return a JSON array of objects. Each object must have:
- search_query: (required) 2-5 word keyword string for Climatiq Search API. NO brand names, NO long descriptions.
- raw_text: (required) Original text as extracted from document
- unit_type: One valid Climatiq unit type or null
- quantity: Numeric value if found, or null
- unit: Unit string (e.g. "t", "kg", "kWh", "usd") or null
- amount: Monetary amount if applicable, or null
- currency: Currency code if applicable (e.g. "usd", "eur") or null
- region: Region code if mentioned or null
- category: One of the categories above
- confidence: "HIGH", "MEDIUM", or "LOW"
- source_doc_index: Index of the source document (0-based)
- source_page: Page/row reference string or null
- note: Any additional context or null

Return ONLY valid JSON array, no markdown fences, no explanation.`;

    geminiParts.push({ text: extractionPrompt });

    await supabase.from("jobs").update({ progress: 45, stage: "parsing", message: "Gemini is analysing your documents…" }).eq("id", jobId);

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: geminiParts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini error:", errText);
      await supabase.from("jobs").update({ status: "failed", message: "AI extraction failed", progress: 100, stage: "done" }).eq("id", jobId);
      return;
    }

    await supabase.from("jobs").update({ progress: 65, stage: "normalizing_queries", message: "Normalising search queries…" }).eq("id", jobId);

    const geminiData = await geminiResp.json();
    let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    rawText = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let extractedActivities: any[];
    try {
      extractedActivities = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse Gemini response:", rawText.slice(0, 500));
      extractedActivities = [];
    }

    // Post-process: normalize search_query values
    extractedActivities = extractedActivities.map((a: any) => ({
      ...a,
      search_query: normalizeSearchQuery(a.search_query || a.raw_text || "unknown"),
      unit_type: validateUnitType(a.unit_type),
    }));

    await supabase.from("jobs").update({ progress: 80, stage: "writing_activities", message: `Writing ${extractedActivities.length} activities…` }).eq("id", jobId);

    // Delete old activities for this project
    await supabase.from("activities").delete().eq("project_id", projectId);

    // Get project region
    const { data: proj } = await supabase.from("projects").select("primary_region").eq("id", projectId).single();

    // Insert new activities
    if (extractedActivities.length > 0) {
      const rows = extractedActivities.map((a: any) => ({
        project_id: projectId,
        text: a.search_query || "Unknown activity",
        search_query: a.search_query || null,
        unit_type: a.unit_type || null,
        region: a.region || proj?.primary_region || null,
        quantity: a.quantity || null,
        unit: a.unit || null,
        amount: a.amount || null,
        currency: a.currency || null,
        source_document_id: a.source_doc_index != null && a.source_doc_index < docIdMap.length ? docIdMap[a.source_doc_index]?.docId : null,
        source_page: a.source_page || null,
        category: a.category || null,
        confidence: a.confidence || null,
        note: a.raw_text ? `Raw: ${(a.raw_text as string).slice(0, 200)}` : a.note || null,
      }));
      await supabase.from("activities").insert(rows);
    }

    await supabase.from("jobs").update({
      status: "succeeded",
      progress: 100,
      stage: "done",
      message: `Extracted ${extractedActivities.length} activities`,
    }).eq("id", jobId);
  } catch (e) {
    console.error("runExtraction error:", e);
    await supabase.from("jobs").update({
      status: "failed",
      progress: 100,
      stage: "done",
      message: e instanceof Error ? e.message : "Extraction failed",
    }).eq("id", jobId).catch(() => {});
  }
}

// ─── Helpers ──────────────────────────────────────────────

const VALID_UNIT_TYPES = new Set([
  "Area", "AreaOverTime", "ContainerOverDistance", "Data", "DataOverTime",
  "Distance", "DistanceOverTime", "Energy", "Power", "Money", "Number",
  "NumberOverTime", "PassengerOverDistance", "Time", "Volume", "Weight",
  "WeightOverDistance", "WeightOverTime",
]);

function validateUnitType(ut: string | null | undefined): string | null {
  if (!ut) return null;
  if (VALID_UNIT_TYPES.has(ut)) return ut;
  // Try case-insensitive match
  for (const valid of VALID_UNIT_TYPES) {
    if (valid.toLowerCase() === ut.toLowerCase()) return valid;
  }
  return null;
}

// Brand → generic lookup for post-processing
const BRAND_MAP: Record<string, string> = {
  nvidia: "computer servers",
  gb200: "computer servers",
  nvl72: "computer servers",
  h100: "gpu servers",
  a100: "gpu servers",
  vertiv: "cooling equipment",
  liebert: "cooling equipment",
  caterpillar: "diesel generator",
  cummins: "diesel generator",
  tesla: "battery lithium ion",
  megapack: "battery lithium ion",
  powerpack: "battery lithium ion",
  abb: "electrical switchgear",
  schneider: "electrical equipment",
  knauf: "insulation glass wool",
  earthwool: "insulation glass wool",
  kingspan: "insulation board",
};

function normalizeSearchQuery(query: string): string {
  if (!query) return "unknown activity";
  
  let q = query.toLowerCase().trim();
  
  // Strip project codes, phase numbers
  q = q.replace(/\b(phase|stage|q[1-4]|fy\d+|20\d{2})\s*\d*/gi, "").trim();
  // Strip adjectives that confuse Climatiq
  q = q.replace(/\b(sustainable|low-carbon|eco-friendly|green|high-performance|premium|advanced)\b/gi, "").trim();
  // Strip filler words
  q = q.replace(/\b(procurement|supply|provision|installation|of|the|and|for|from|with)\b/gi, " ").trim();
  
  // Check brand lookup
  const words = q.split(/\s+/);
  for (const word of words) {
    if (BRAND_MAP[word]) {
      return BRAND_MAP[word];
    }
  }
  
  // Truncate to max 5 words
  const cleaned = q.replace(/\s+/g, " ").trim().split(" ").slice(0, 5).join(" ");
  return cleaned || "unknown activity";
}

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
