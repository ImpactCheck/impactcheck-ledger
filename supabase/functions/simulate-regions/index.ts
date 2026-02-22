import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DATA_VERSION = "^21";

function toUnitTypeArray(unitType: unknown): string[] {
  if (Array.isArray(unitType)) return unitType.map((u) => String(u).toLowerCase());
  if (unitType != null && unitType !== "") return [String(unitType).toLowerCase()];
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectId } = await req.json();
    if (!projectId) throw new Error("projectId required");

    const CLIMATIQ_API_KEY = Deno.env.get("CLIMATIQ_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create simulation job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({ project_id: projectId, type: "simulation", status: "running", progress: 5, stage: "loading_activities" })
      .select()
      .single();
    if (jobErr) throw jobErr;

    const work = runSimulation(job.id, projectId, supabase, CLIMATIQ_API_KEY ?? null);
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined") {
      EdgeRuntime.waitUntil(work);
    } else {
      work.catch((e) => console.error("Background simulation error:", e));
    }

    return new Response(JSON.stringify(formatJob(job)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("simulate-regions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatJob(d: any) {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    progress: d.progress,
    stage: d.stage,
    message: d.message,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

async function runSimulation(
  jobId: string,
  projectId: string,
  supabase: ReturnType<typeof createClient>,
  CLIMATIQ_API_KEY: string | null,
): Promise<void> {
  try {
    const { data: activities } = await supabase
      .from("activities")
      .select("*")
      .eq("project_id", projectId);

    if (!activities || activities.length === 0) {
      await supabase.from("jobs").update({ status: "failed", message: "No activities found", progress: 100, stage: "done" }).eq("id", jobId);
      return;
    }

    const { data: proj } = await supabase.from("projects").select("primary_region, comparison_regions").eq("id", projectId).single();
    const comparisonRegions = (proj?.comparison_regions || []).filter(Boolean);

    if (comparisonRegions.length === 0) {
      await supabase.from("jobs").update({ status: "succeeded", message: "No comparison regions to simulate", progress: 100, stage: "done" }).eq("id", jobId);
      return;
    }

    await supabase.from("jobs").update({ progress: 10, stage: "searching_factors", message: `Simulating ${comparisonRegions.length} region(s) for ${activities.length} activities…` }).eq("id", jobId);

    // Delete old simulation estimates for this project
    await supabase.from("simulation_estimates").delete().eq("project_id", projectId);

    const estimates: any[] = [];
    const total = activities.length * comparisonRegions.length;
    const useStub = !CLIMATIQ_API_KEY;
    let processed = 0;

    for (const regionKey of comparisonRegions) {
      const climatiqRegion = mapRegionToClimatiq(regionKey);

      for (let i = 0; i < activities.length; i++) {
        const act = activities[i];
        processed++;
        const progress = 10 + Math.floor((processed / total) * 80);
        const searchQuery = act.search_query || act.text;
        const region = act.region ? mapRegionToClimatiq(act.region) : climatiqRegion;
        const currentStage = processed < total / 2 ? "searching_factors" : "estimating";

        await supabase.from("jobs").update({
          progress,
          stage: currentStage,
          message: `Simulating activity ${i + 1}/${activities.length} for ${regionKey}…`,
        }).eq("id", jobId);

        try {
          if (useStub) {
            const stubResult = stubEstimate(act, searchQuery, regionKey);
            estimates.push({
              project_id: projectId,
              activity_id: act.id,
              simulation_region: regionKey,
              region: regionKey,
              matched_factor: stubResult.matched_factor,
              confidence: stubResult.confidence,
              co2e_kg: stubResult.co2e_kg,
              input_used: { unit_type: act.unit_type, quantity: act.quantity, amount: act.amount, currency: act.currency },
            });
            continue;
          }

          const searchResult = await searchFactors(CLIMATIQ_API_KEY!, searchQuery, region, act.unit_type);

          if (!searchResult.factor) {
            estimates.push({
              ...fallbackEstimate(projectId, act, null, searchResult.confidence, regionKey),
              simulation_region: regionKey,
            });
            continue;
          }

          if (!act.quantity && !act.amount) {
            estimates.push({
              project_id: projectId,
              activity_id: act.id,
              simulation_region: regionKey,
              region: regionKey,
              matched_factor: {
                id: searchResult.factor.activity_id,
                name: searchResult.factor.name,
                source: searchResult.factor.source,
                year: searchResult.factor.year,
                unit: toUnitTypeArray(searchResult.factor.unit_type)[0] ?? null,
              },
              confidence: searchResult.confidence * 0.5,
              co2e_kg: 0,
              input_used: { unit_type: act.unit_type, quantity: null, amount: null, note: "needs_quantity" },
            });
            continue;
          }

          const params = buildParameters(act, searchResult.factor);
          const estimateResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, params, region);

          if (estimateResult.error) {
            // Try recovery strategies (same as mapping)
            let retryResult: EstimateResult | null = null;
            const validTypes1 = parseValidUnitTypes(estimateResult.error);
            if (validTypes1.length > 0) {
              const adapted = adaptParametersToValidTypes(act, validTypes1);
              if (adapted) {
                retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, adapted, region);
                if (retryResult.error) retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, adapted, null);
                if (!retryResult.error) { estimates.push({ ...buildEstimateRow(projectId, act, retryResult, searchResult.factor, searchResult.confidence * 0.7, regionKey), simulation_region: regionKey }); continue; }
              }
            }
            retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, params, null);
            if (!retryResult.error) { estimates.push({ ...buildEstimateRow(projectId, act, retryResult, searchResult.factor, searchResult.confidence * 0.8, regionKey), simulation_region: regionKey }); continue; }
            const validTypes2 = parseValidUnitTypes(retryResult.error!);
            if (validTypes2.length > 0) {
              const adapted2 = adaptParametersToValidTypes(act, validTypes2);
              if (adapted2) {
                retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, adapted2, null);
                if (!retryResult.error) { estimates.push({ ...buildEstimateRow(projectId, act, retryResult, searchResult.factor, searchResult.confidence * 0.6, regionKey), simulation_region: regionKey }); continue; }
              }
            }
            const allValidTypes = [...new Set([...validTypes1, ...validTypes2])];
            if (allValidTypes.length > 0) {
              const llmParams = await llmConvertUnits(act, allValidTypes);
              if (llmParams) {
                retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, llmParams, region);
                if (retryResult.error) retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, llmParams, null);
                if (!retryResult.error) { estimates.push({ ...buildEstimateRow(projectId, act, retryResult, searchResult.factor, searchResult.confidence * 0.5, regionKey), simulation_region: regionKey }); continue; }
              }
            }
            estimates.push({ ...fallbackEstimate(projectId, act, searchResult.factor, searchResult.confidence * 0.5, regionKey), simulation_region: regionKey });
          } else {
            estimates.push({ ...buildEstimateRow(projectId, act, estimateResult, searchResult.factor, searchResult.confidence, regionKey), simulation_region: regionKey });
          }
        } catch (err) {
          console.error(`Error simulating activity ${act.id}:`, err);
          estimates.push({ ...fallbackEstimate(projectId, act, null, 0.2, regionKey), simulation_region: regionKey });
        }
      }
    }

    // Insert simulation estimates
    if (estimates.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < estimates.length; i += batchSize) {
        await supabase.from("simulation_estimates").insert(estimates.slice(i, i + batchSize));
      }
    }

    const succeeded = estimates.filter((e) => e.co2e_kg > 0).length;

    await supabase.from("jobs").update({
      status: "succeeded",
      progress: 100,
      stage: "done",
      message: `Simulated ${estimates.length} estimates across ${comparisonRegions.length} region(s) (${succeeded} with CO₂e values)${useStub ? " [stub mode]" : ""}`,
    }).eq("id", jobId);
  } catch (e) {
    console.error("runSimulation error:", e);
    await supabase.from("jobs").update({
      status: "failed",
      progress: 100,
      stage: "done",
      message: e instanceof Error ? e.message : "Simulation failed",
    }).eq("id", jobId).catch(() => {});
  }
}

// ─── Climatiq API Functions (mirrored from mapping) ──────────────────────────

interface SearchResult {
  factor: any | null;
  confidence: number;
  fallbackUsed: string;
}

function shorterQueryVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let n = words.length - 1; n >= 1; n--) {
    out.push(words.slice(0, n).join(" "));
  }
  return out;
}

async function searchFactors(apiKey: string, query: string, region: string | null, unitType: string | null): Promise<SearchResult> {
  const tryQuery = async (q: string, confidenceScale: number): Promise<SearchResult | null> => {
    let factors = await callSearch(apiKey, q, region, unitType);
    if (factors.length > 0) return { factor: factors[0], confidence: 0.9 * confidenceScale, fallbackUsed: "none" };
    factors = await callSearch(apiKey, q, null, unitType);
    if (factors.length > 0) return { factor: factors[0], confidence: 0.75 * confidenceScale, fallbackUsed: "no_region" };
    factors = await callSearch(apiKey, q, null, null);
    if (factors.length > 0) return { factor: factors[0], confidence: 0.55 * confidenceScale, fallbackUsed: "no_region_no_unit" };
    return null;
  };
  const full = await tryQuery(query, 1);
  if (full) return full;
  for (const shorter of shorterQueryVariants(query)) {
    const result = await tryQuery(shorter, 0.85);
    if (result) return { ...result, fallbackUsed: "shorter_query" };
  }
  return { factor: null, confidence: 0, fallbackUsed: "all_failed" };
}

async function callSearch(apiKey: string, query: string, region: string | null, unitType: string | null): Promise<any[]> {
  const params = new URLSearchParams({ query, data_version: DATA_VERSION, results_per_page: "5" });
  if (region && region !== "GLOBAL") params.set("region", region);
  if (unitType) params.set("unit_type", unitType);
  const resp = await fetchWithRetry(`https://api.climatiq.io/data/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) { console.error(`Search failed for "${query}":`, await resp.text()); return []; }
  const data = await resp.json();
  return data.results || [];
}

interface EstimateResult {
  co2e_kg: number;
  emission_factor: any;
  constituent_gases: any;
  error?: string;
}

async function estimateSingle(apiKey: string, activityId: string, parameters: any, region: string | null): Promise<EstimateResult> {
  const body: any = { emission_factor: { activity_id: activityId, data_version: DATA_VERSION }, parameters };
  if (region && region !== "GLOBAL") body.emission_factor.region = region;
  const resp = await fetchWithRetry("https://api.climatiq.io/data/v1/estimate", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return { co2e_kg: 0, emission_factor: null, constituent_gases: null, error: await resp.text() };
  const data = await resp.json();
  return { co2e_kg: data.co2e || 0, emission_factor: data.emission_factor || {}, constituent_gases: data.constituent_gases || null };
}

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 4): Promise<Response> {
  let delay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, init);
    if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
      if (attempt < maxRetries) { await new Promise((r) => setTimeout(r, delay)); delay *= 2; continue; }
    }
    return resp;
  }
  return fetch(url, init);
}

function buildEstimateRow(projectId: string, act: any, result: EstimateResult, factor: any, confidence: number, regionKey?: string) {
  return {
    project_id: projectId,
    activity_id: act.id,
    region: regionKey ?? act.region,
    matched_factor: {
      id: result.emission_factor?.activity_id || factor.activity_id,
      name: result.emission_factor?.name || factor.name,
      source: result.emission_factor?.source || factor.source,
      year: result.emission_factor?.year || factor.year,
      unit: toUnitTypeArray(factor.unit_type)[0] ?? act.unit_type,
    },
    confidence,
    co2e_kg: result.co2e_kg,
    input_used: { unit_type: act.unit_type, quantity: act.quantity, amount: act.amount, currency: act.currency },
  };
}

function buildParameters(act: any, factor: any): any {
  const factorUnitTypes: string[] = toUnitTypeArray(factor.unit_type);
  if (act.unit_type === "Money" && act.amount) return { money: act.amount, money_unit: (act.currency || "usd").toLowerCase() };
  if (act.unit_type === "Energy" && act.quantity) return { energy: act.quantity, energy_unit: mapEnergyUnit(act.unit) };
  if (act.unit_type === "Weight" && act.quantity) return { weight: act.quantity, weight_unit: mapWeightUnit(act.unit) };
  if (act.unit_type === "Volume" && act.quantity) return { volume: act.quantity, volume_unit: mapVolumeUnit(act.unit) };
  if (act.unit_type === "Distance" && act.quantity) return { distance: act.quantity, distance_unit: mapDistanceUnit(act.unit) };
  if (act.unit_type === "Number" && act.quantity) return { number: act.quantity };
  if (act.unit_type === "Power" && act.quantity) return { energy: act.quantity * 8760, energy_unit: act.unit?.toLowerCase().includes("mw") ? "MWh" : "kWh" };
  if (act.unit_type === "Area" && act.quantity) return { area: act.quantity, area_unit: act.unit || "m2" };
  if (act.unit_type === "Data" && act.quantity) return { data: act.quantity, data_unit: act.unit || "GB" };
  if (act.unit_type === "Time" && act.quantity) return { time: act.quantity, time_unit: act.unit || "hour" };
  if (act.quantity) {
    if (factorUnitTypes.includes("weight")) return { weight: act.quantity, weight_unit: mapWeightUnit(act.unit) };
    if (factorUnitTypes.includes("energy")) return { energy: act.quantity, energy_unit: mapEnergyUnit(act.unit) };
    if (factorUnitTypes.includes("money")) return { money: act.quantity, money_unit: (act.currency || "usd").toLowerCase() };
    if (factorUnitTypes.includes("number")) return { number: act.quantity };
  }
  if (act.amount) return { money: act.amount, money_unit: (act.currency || "usd").toLowerCase() };
  return { number: act.quantity || 1 };
}

function fallbackEstimate(projectId: string, act: any, factor: any | null, confidence: number, regionKey?: string) {
  return {
    project_id: projectId,
    activity_id: act.id,
    region: regionKey ?? act.region,
    matched_factor: factor ? { id: factor.activity_id, name: factor.name, source: factor.source, year: factor.year, unit: toUnitTypeArray(factor.unit_type)[0] ?? null } : { id: "no_match", name: "No match found", source: "N/A" },
    confidence,
    co2e_kg: 0,
    input_used: { unit_type: act.unit_type, quantity: act.quantity, amount: act.amount, currency: act.currency },
  };
}

function stubEstimate(act: any, _query: string, regionKey: string) {
  // Stub mode: ZERO carbon impact only — no estimates without Climatiq API data
  return {
    matched_factor: { id: `stub_${act.id}`, name: `Stub factor for ${act.text.slice(0, 30)}`, source: "Stub (no CLIMATIQ_API_KEY)", year: 2025 },
    confidence: 0.3,
    co2e_kg: 0,
  };
}

function parseValidUnitTypes(errorText: string): string[] {
  const match = errorText.match(/valid unit_type values?[:\s]+\[([^\]]+)\]/i)
    || errorText.match(/unit_type must be one of[:\s]+\[([^\]]+)\]/i)
    || errorText.match(/allowed.*unit_type.*?:\s*\[([^\]]+)\]/i);
  if (!match) return [];
  return match[1].split(",").map((s) => s.trim().replace(/['"]/g, "").toLowerCase()).filter(Boolean);
}

function adaptParametersToValidTypes(act: any, validTypes: string[]): any | null {
  for (const vt of validTypes) {
    if (vt === "money" && (act.amount || act.quantity)) return { money: act.amount || act.quantity, money_unit: (act.currency || "usd").toLowerCase() };
    if (vt === "energy" && act.quantity) return { energy: act.quantity, energy_unit: mapEnergyUnit(act.unit) };
    if (vt === "weight" && act.quantity) return { weight: act.quantity, weight_unit: mapWeightUnit(act.unit) };
    if (vt === "number" && act.quantity) return { number: act.quantity };
    if (vt === "volume" && act.quantity) return { volume: act.quantity, volume_unit: mapVolumeUnit(act.unit) };
    if (vt === "distance" && act.quantity) return { distance: act.quantity, distance_unit: mapDistanceUnit(act.unit) };
  }
  return null;
}

async function llmConvertUnits(act: any, validTypes: string[]): Promise<any | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `Convert this activity data to one of these Climatiq parameter types: ${validTypes.join(", ")}.
We require Climatiq API data for carbon estimates — ZERO is output when no valid conversion exists. Do NOT fabricate.
Activity: "${act.text}", quantity=${act.quantity}, unit="${act.unit}", unit_type="${act.unit_type}", amount=${act.amount}, currency="${act.currency}".
Return ONLY a JSON object with the converted parameters (e.g. {"energy": 100, "energy_unit": "kWh"}). If conversion is not defensible, return {"_skip": true}.`;
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 200 } }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const params = JSON.parse(jsonMatch[0]);
    if (params._skip === true) return null;
    return params;
  } catch { return null; }
}

// ─── Region mapping ─────────────────────────────────────

const REGION_MAP: Record<string, string> = {
  us: "US", eu: "EU", uk: "GB", china: "CN", india: "IN", japan: "JP",
  germany: "DE", france: "FR", canada: "CA", australia: "AU", brazil: "BR",
  south_korea: "KR", mexico: "MX", indonesia: "ID", south_africa: "ZA",
  saudi_arabia: "SA", uae: "AE", norway: "NO", sweden: "SE", finland: "FI",
  denmark: "DK", iceland: "IS", singapore: "SG", taiwan: "TW", global: "GLOBAL",
};

function mapRegionToClimatiq(region: string): string {
  return REGION_MAP[region.toLowerCase()] || region.toUpperCase();
}

function mapEnergyUnit(u?: string | null): string {
  if (!u) return "kWh";
  const l = u.toLowerCase();
  if (l.includes("mwh")) return "MWh";
  if (l.includes("gwh")) return "GWh";
  if (l.includes("mj")) return "MJ";
  if (l.includes("gj")) return "GJ";
  if (l.includes("therm")) return "therm";
  if (l.includes("btu")) return "Btu";
  return "kWh";
}

function mapWeightUnit(u?: string | null): string {
  if (!u) return "kg";
  const l = u.toLowerCase();
  if (l.includes("mt") || l.includes("tonne") || l.includes("metric")) return "t";
  if (l.includes("lb") || l.includes("pound")) return "lb";
  if (l.includes("oz") || l.includes("ounce")) return "oz";
  if (l === "g" || l === "gram" || l === "grams") return "g";
  return "kg";
}

function mapVolumeUnit(u?: string | null): string {
  if (!u) return "l";
  const l = u.toLowerCase();
  if (l.includes("gal")) return "gal";
  if (l.includes("ml")) return "ml";
  if (l.includes("m3") || l.includes("m³") || l.includes("cubic")) return "m3";
  return "l";
}

function mapDistanceUnit(u?: string | null): string {
  if (!u) return "km";
  const l = u.toLowerCase();
  if (l.includes("mi")) return "mi";
  if (l.includes("nm") || l.includes("nautical")) return "nmi";
  return "km";
}
