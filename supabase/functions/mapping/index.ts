import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DATA_VERSION = "^21";

/** Normalize Climatiq factor unit_type (may be string or string[]) to string[]. */
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

    // Create job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({ project_id: projectId, type: "mapping", status: "running", progress: 5, stage: "loading_activities" })
      .select()
      .single();
    if (jobErr) throw jobErr;

    // Get activities
    const { data: activities } = await supabase
      .from("activities")
      .select("*")
      .eq("project_id", projectId);

    if (!activities || activities.length === 0) {
      await supabase.from("jobs").update({ status: "failed", message: "No activities found", progress: 100 }).eq("id", job.id);
      return new Response(JSON.stringify(formatJob({ ...job, status: "failed", message: "No activities found" })), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get project for region info
    const { data: proj } = await supabase.from("projects").select("primary_region").eq("id", projectId).single();
    const projectRegion = mapRegionToClimatiq(proj?.primary_region || "");

    await supabase.from("jobs").update({ progress: 10, stage: "searching_factors" }).eq("id", job.id);

    // Delete old estimates
    await supabase.from("estimates").delete().eq("project_id", projectId);

    const estimates: any[] = [];
    const total = activities.length;
    const useStub = !CLIMATIQ_API_KEY;

    for (let i = 0; i < total; i++) {
      const act = activities[i];
      const progress = 10 + Math.floor((i / total) * 75);
      const searchQuery = act.search_query || act.text;
      const region = act.region ? mapRegionToClimatiq(act.region) : projectRegion;

      await supabase.from("jobs").update({
        progress,
        stage: i < total / 2 ? "searching_factors" : "estimating",
      }).eq("id", job.id);

      try {
        if (useStub) {
          // ── Deterministic stub mode ──
          const stubResult = stubEstimate(act, searchQuery);
          estimates.push({
            project_id: projectId,
            activity_id: act.id,
            region: act.region,
            matched_factor: stubResult.matched_factor,
            confidence: stubResult.confidence,
            co2e_kg: stubResult.co2e_kg,
            input_used: { unit_type: act.unit_type, quantity: act.quantity, amount: act.amount, currency: act.currency },
          });
          continue;
        }

        // ── Step 1: Search for emission factors ──
        const searchResult = await searchFactors(CLIMATIQ_API_KEY!, searchQuery, region, act.unit_type);

        if (!searchResult.factor) {
          console.warn(`No factors found for "${searchQuery}" after all fallbacks`);
          estimates.push(fallbackEstimate(projectId, act, null, searchResult.confidence));
          continue;
        }

        // ── Step 2: Estimate ──
        if (!act.quantity && !act.amount) {
          // No quantity — store search result only, flag as needs_quantity
          estimates.push({
            project_id: projectId,
            activity_id: act.id,
            region: act.region,
            matched_factor: {
              id: searchResult.factor.activity_id,
              name: searchResult.factor.name,
              source: searchResult.factor.source,
              year: searchResult.factor.year,
              unit: toUnitTypeArray(searchResult.factor.unit_type)[0] ?? null,
            },
            confidence: searchResult.confidence * 0.5, // lower confidence without estimate
            co2e_kg: 0,
            input_used: { unit_type: act.unit_type, quantity: null, amount: null, note: "needs_quantity" },
          });
          continue;
        }

        const params = buildParameters(act, searchResult.factor);
        const estimateResult = await estimateSingle(
          CLIMATIQ_API_KEY!,
          searchResult.factor.activity_id,
          params,
          region
        );

        if (estimateResult.error) {
          // Try multiple recovery strategies
          let retryResult: EstimateResult | null = null;

          // Strategy 1: adapt parameters based on error's valid_values
          const validTypes1 = parseValidUnitTypes(estimateResult.error);
          if (validTypes1.length > 0) {
            const adapted = adaptParametersToValidTypes(act, validTypes1);
            if (adapted) {
              retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, adapted, region);
              if (retryResult.error) retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, adapted, null);
              if (!retryResult.error) { estimates.push(buildEstimateRow(projectId, act, retryResult, searchResult.factor, searchResult.confidence * 0.7)); continue; }
            }
          }

          // Strategy 2: retry without region (original params)
          retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, params, null);
          if (!retryResult.error) { estimates.push(buildEstimateRow(projectId, act, retryResult, searchResult.factor, searchResult.confidence * 0.8)); continue; }

          // Strategy 3: adapt parameters from strategy 2's error
          const validTypes2 = parseValidUnitTypes(retryResult.error!);
          if (validTypes2.length > 0) {
            const adapted2 = adaptParametersToValidTypes(act, validTypes2);
            if (adapted2) {
              retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, adapted2, null);
              if (!retryResult.error) { estimates.push(buildEstimateRow(projectId, act, retryResult, searchResult.factor, searchResult.confidence * 0.6)); continue; }
            }
          }

          // Strategy 4: LLM-assisted unit conversion
          const allValidTypes = [...new Set([...validTypes1, ...validTypes2])];
          if (allValidTypes.length > 0) {
            const llmParams = await llmConvertUnits(act, allValidTypes);
            if (llmParams) {
              retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, llmParams, region);
              if (retryResult.error) retryResult = await estimateSingle(CLIMATIQ_API_KEY!, searchResult.factor.activity_id, llmParams, null);
              if (!retryResult.error) {
                console.log(`LLM conversion succeeded for ${searchResult.factor.activity_id}`);
                estimates.push(buildEstimateRow(projectId, act, retryResult, searchResult.factor, searchResult.confidence * 0.5));
                continue;
              }
            }
          }

          console.error(`Estimate failed for ${searchResult.factor.activity_id}:`, retryResult?.error || estimateResult.error);
          estimates.push(fallbackEstimate(projectId, act, searchResult.factor, searchResult.confidence * 0.5));
        } else {
          estimates.push(buildEstimateRow(projectId, act, estimateResult, searchResult.factor, searchResult.confidence));
        }
      } catch (err) {
        console.error(`Error mapping activity ${act.id}:`, err);
        estimates.push(fallbackEstimate(projectId, act, null, 0.2));
      }
    }

    // Insert estimates
    if (estimates.length > 0) {
      await supabase.from("estimates").insert(estimates);
    }

    await supabase.from("jobs").update({ progress: 90, stage: "ranking" }).eq("id", job.id);

    const succeeded = estimates.filter((e) => e.co2e_kg > 0).length;

    await supabase.from("jobs").update({
      status: "succeeded",
      progress: 100,
      stage: "done",
      message: `Mapped ${estimates.length} activities (${succeeded} with estimates)${useStub ? " [stub mode]" : ""}`,
    }).eq("id", job.id);

    const { data: updatedJob } = await supabase.from("jobs").select("*").eq("id", job.id).single();

    return new Response(JSON.stringify(formatJob(updatedJob)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mapping error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Climatiq API Functions ──────────────────────────────

interface SearchResult {
  factor: any | null;
  confidence: number;
  fallbackUsed: string;
}

/** Shorter query variants by dropping the last word (e.g. "battery ups system" → ["battery ups", "battery"]). */
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

async function searchFactors(
  apiKey: string,
  query: string,
  region: string | null,
  unitType: string | null,
): Promise<SearchResult> {
  const tryQuery = async (q: string, confidenceScale: number): Promise<SearchResult | null> => {
    let factors = await callSearch(apiKey, q, region, unitType);
    if (factors.length > 0) return { factor: factors[0], confidence: 0.9 * confidenceScale, fallbackUsed: "none" };
    factors = await callSearch(apiKey, q, null, unitType);
    if (factors.length > 0) return { factor: factors[0], confidence: 0.75 * confidenceScale, fallbackUsed: "no_region" };
    factors = await callSearch(apiKey, q, null, null);
    if (factors.length > 0) return { factor: factors[0], confidence: 0.55 * confidenceScale, fallbackUsed: "no_region_no_unit" };
    return null;
  };

  // Attempt 1–3: full query with region/unit fallbacks
  const full = await tryQuery(query, 1);
  if (full) return full;

  // Attempt 4+: shorter query variants (e.g. "battery ups system" → "battery ups" → "battery")
  for (const shorter of shorterQueryVariants(query)) {
    const result = await tryQuery(shorter, 0.85);
    if (result) {
      return { ...result, fallbackUsed: "shorter_query" };
    }
  }

  return { factor: null, confidence: 0, fallbackUsed: "all_failed" };
}

async function callSearch(
  apiKey: string,
  query: string,
  region: string | null,
  unitType: string | null,
): Promise<any[]> {
  const params = new URLSearchParams({
    query,
    data_version: DATA_VERSION,
    results_per_page: "5",
  });

  if (region && region !== "GLOBAL") {
    params.set("region", region);
  }
  if (unitType) {
    params.set("unit_type", unitType);
  }

  const resp = await fetchWithRetry(
    `https://api.climatiq.io/data/v1/search?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Search failed for "${query}" (region=${region}, unit=${unitType}):`, errText);
    return [];
  }

  const data = await resp.json();
  return data.results || [];
}

interface EstimateResult {
  co2e_kg: number;
  emission_factor: any;
  constituent_gases: any;
  error?: string;
}

async function estimateSingle(
  apiKey: string,
  activityId: string,
  parameters: any,
  region: string | null,
): Promise<EstimateResult> {
  const body: any = {
    emission_factor: {
      activity_id: activityId,
      data_version: DATA_VERSION,
    },
    parameters,
  };

  if (region && region !== "GLOBAL") {
    body.emission_factor.region = region;
  }

  const resp = await fetchWithRetry("https://api.climatiq.io/data/v1/estimate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    return { co2e_kg: 0, emission_factor: null, constituent_gases: null, error: errText };
  }

  const data = await resp.json();
  return {
    co2e_kg: data.co2e || 0,
    emission_factor: data.emission_factor || {},
    constituent_gases: data.constituent_gases || null,
  };
}

// ─── Retry with exponential backoff ─────────────────────

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 4): Promise<Response> {
  let delay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, init);
    if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
      if (attempt < maxRetries) {
        console.warn(`Retry ${attempt + 1}/${maxRetries} for ${url} (status ${resp.status}), waiting ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
    }
    return resp;
  }
  // Should not reach here, but just in case
  return fetch(url, init);
}

// ─── Build estimate row ─────────────────────────────────

function buildEstimateRow(projectId: string, act: any, result: EstimateResult, factor: any, confidence: number) {
  return {
    project_id: projectId,
    activity_id: act.id,
    region: act.region,
    matched_factor: {
      id: result.emission_factor?.activity_id || factor.activity_id,
      name: result.emission_factor?.name || factor.name,
      source: result.emission_factor?.source || factor.source,
      year: result.emission_factor?.year || factor.year,
      unit: toUnitTypeArray(factor.unit_type)[0] ?? act.unit_type,
    },
    confidence,
    co2e_kg: result.co2e_kg,
    input_used: {
      unit_type: act.unit_type,
      quantity: act.quantity,
      amount: act.amount,
      currency: act.currency,
    },
  };
}

// ─── Parameter building ─────────────────────────────────

function buildParameters(act: any, factor: any): any {
  const factorUnitTypes: string[] = toUnitTypeArray(factor.unit_type);

  if (act.unit_type === "Money" && act.amount) {
    return { money: act.amount, money_unit: (act.currency || "usd").toLowerCase() };
  }
  if (act.unit_type === "Energy" && act.quantity) {
    return { energy: act.quantity, energy_unit: mapEnergyUnit(act.unit) };
  }
  if (act.unit_type === "Weight" && act.quantity) {
    return { weight: act.quantity, weight_unit: mapWeightUnit(act.unit) };
  }
  if (act.unit_type === "Volume" && act.quantity) {
    return { volume: act.quantity, volume_unit: mapVolumeUnit(act.unit) };
  }
  if (act.unit_type === "Distance" && act.quantity) {
    return { distance: act.quantity, distance_unit: mapDistanceUnit(act.unit) };
  }
  if (act.unit_type === "Number" && act.quantity) {
    return { number: act.quantity };
  }
  if (act.unit_type === "Power" && act.quantity) {
    return { energy: act.quantity * 8760, energy_unit: act.unit?.toLowerCase().includes("mw") ? "MWh" : "kWh" };
  }
  if (act.unit_type === "Area" && act.quantity) {
    return { area: act.quantity, area_unit: act.unit || "m2" };
  }
  if (act.unit_type === "Data" && act.quantity) {
    return { data: act.quantity, data_unit: act.unit || "GB" };
  }
  if (act.unit_type === "Time" && act.quantity) {
    return { time: act.quantity, time_unit: act.unit || "hour" };
  }

  // Fallback: match to what factor expects
  if (act.quantity) {
    if (factorUnitTypes.includes("weight")) return { weight: act.quantity, weight_unit: mapWeightUnit(act.unit) };
    if (factorUnitTypes.includes("energy")) return { energy: act.quantity, energy_unit: mapEnergyUnit(act.unit) };
    if (factorUnitTypes.includes("money")) return { money: act.quantity, money_unit: (act.currency || "usd").toLowerCase() };
    if (factorUnitTypes.includes("volume")) return { volume: act.quantity, volume_unit: mapVolumeUnit(act.unit) };
    if (factorUnitTypes.includes("number")) return { number: act.quantity };
    return { weight: act.quantity, weight_unit: mapWeightUnit(act.unit) };
  }

  if (act.amount) {
    return { money: act.amount, money_unit: (act.currency || "usd").toLowerCase() };
  }

  if (factorUnitTypes.includes("money")) return { money: 1000, money_unit: "usd" };
  return { weight: 1, weight_unit: "kg" };
}

// ─── Error-driven parameter adaptation ──────────────────

function parseValidUnitTypes(errorText: string): string[] {
  try {
    const parsed = typeof errorText === "string" ? JSON.parse(errorText) : errorText;
    return parsed?.valid_values?.unit_type || [];
  } catch { return []; }
}

function adaptParametersToValidTypes(act: any, validTypes: string[]): any | null {
  const qty = act.quantity || act.amount || 1;
  for (const vt of validTypes) {
    const lt = vt.toLowerCase();
    if (lt === "distance") return { distance: qty, distance_unit: mapDistanceUnit(act.unit) };
    if (lt === "weight") return { weight: qty, weight_unit: mapWeightUnit(act.unit) };
    if (lt === "energy") return { energy: qty, energy_unit: mapEnergyUnit(act.unit) };
    if (lt === "volume") return { volume: qty, volume_unit: mapVolumeUnit(act.unit) };
    if (lt === "money") return { money: qty, money_unit: (act.currency || "usd").toLowerCase() };
    if (lt === "number") return { number: qty };
    if (lt === "numberovertime") return { number: qty, time: 1, time_unit: "year" };
    if (lt === "time") return { time: qty, time_unit: act.unit || "hour" };
    if (lt === "area") return { area: qty, area_unit: act.unit || "m2" };
  }
  return null;
}

// ─── LLM-assisted unit conversion ───────────────────────

async function llmConvertUnits(act: any, validUnitTypes: string[]): Promise<any | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const prompt = `You are an expert in carbon accounting unit conversions.

An activity needs a CO2 emission estimate but Climatiq rejected the unit type.

Activity details:
- Text: "${act.text}"
- Original unit type: "${act.unit_type || "Unknown"}"
- Quantity: ${act.quantity ?? "null"}
- Unit: "${act.unit || "not specified"}"
- Amount (money): ${act.amount ?? "null"}
- Currency: "${act.currency || "not specified"}"

Climatiq requires one of these unit types: ${JSON.stringify(validUnitTypes)}

Convert the activity data into Climatiq API parameters using one of the valid unit types.
Use reasonable engineering assumptions if needed (e.g. solar panel capacity → annual energy output in kWh, passenger flight → passenger-km, container shipping → container-km).

Respond ONLY with a JSON object containing the Climatiq parameters. Examples:
- For "Power" type: {"energy": 8760, "energy_unit": "kWh"} (1 kW * 8760 hours/year)
- For "PassengerOverDistance": {"passengers": 1, "distance": 1000, "distance_unit": "km"}
- For "ContainerOverDistance": {"containers": 1, "distance": 1000, "distance_unit": "km"}
- For "WeightOverDistance": {"weight": 1000, "weight_unit": "kg", "distance": 100, "distance_unit": "km"}

Respond with ONLY the JSON object, no explanation.`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      console.error("LLM conversion call failed:", resp.status);
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const params = JSON.parse(jsonMatch[0]);
    console.log(`LLM converted "${act.text}" (${act.unit_type}) → ${JSON.stringify(params)}`);
    return params;
  } catch (err) {
    console.error("LLM unit conversion error:", err);
    return null;
  }
}

// ─── Stub mode ──────────────────────────────────────────

function stubEstimate(act: any, searchQuery: string) {
  const q = searchQuery.toLowerCase();
  let activityId = "consumer_goods-type_general";
  let factorName = "General consumer goods";

  if (q.includes("cement") || q.includes("concrete")) {
    activityId = "building_materials-type_cement";
    factorName = "Cement production";
  } else if (q.includes("steel")) {
    activityId = "metals-type_basic_iron_and_steel";
    factorName = "Steel production";
  } else if (q.includes("electricity") || q.includes("grid")) {
    activityId = "electricity-supply_grid-source_residual_mix";
    factorName = "Electricity grid supply";
  } else if (q.includes("diesel")) {
    activityId = "fuel_type_diesel-fuel_use_stationary";
    factorName = "Diesel fuel combustion";
  } else if (q.includes("natural gas") || q.includes("gas")) {
    activityId = "fuel_type_natural_gas-fuel_use_stationary";
    factorName = "Natural gas combustion";
  } else if (q.includes("server") || q.includes("gpu") || q.includes("computer")) {
    activityId = "electrical_equipment-type_server";
    factorName = "Server equipment";
  } else if (q.includes("cooling")) {
    activityId = "electrical_equipment-type_cooling";
    factorName = "Cooling equipment";
  } else if (q.includes("freight") || q.includes("transport") || q.includes("truck")) {
    activityId = "freight_vehicle-vehicle_type_hgv-fuel_source_na";
    factorName = "Freight transport";
  } else if (q.includes("aluminum")) {
    activityId = "metals-type_aluminium";
    factorName = "Aluminum production";
  } else if (q.includes("copper")) {
    activityId = "metals-type_copper";
    factorName = "Copper production";
  } else if (q.includes("water")) {
    activityId = "water-type_supply";
    factorName = "Water supply";
  }

  // Deterministic estimate
  const quantity = act.quantity || act.amount || 1;
  const factors: Record<string, number> = {
    Weight: 0.9,
    Energy: 0.4,
    Volume: 2.7,
    Money: 0.5,
    Power: 0.4 * 8760,
    Distance: 0.12,
    Number: 50,
    Area: 15,
  };
  const factor = factors[act.unit_type as string] || 1.0;
  const co2e_kg = quantity * factor;

  return {
    matched_factor: {
      id: activityId,
      name: factorName,
      source: "Stub (no API key)",
      year: 2023,
      unit: act.unit_type,
    },
    confidence: 0.5,
    co2e_kg: Math.round(co2e_kg * 100) / 100,
  };
}

// ─── Fallback estimate ──────────────────────────────────

function fallbackEstimate(projectId: string, act: any, factor: any, confidence: number) {
  return {
    project_id: projectId,
    activity_id: act.id,
    region: act.region,
    matched_factor: {
      id: factor?.activity_id || "unmatched",
      name: factor?.name || "No factor matched",
      source: factor?.source || "N/A",
      year: factor?.year,
      unit: factor != null ? (toUnitTypeArray(factor.unit_type)[0] ?? null) : null,
    },
    confidence,
    co2e_kg: 0,
    input_used: { unit_type: act.unit_type, quantity: act.quantity, amount: act.amount, currency: act.currency },
  };
}

// ─── Region mapping ─────────────────────────────────────

function mapRegionToClimatiq(region: string): string {
  const map: Record<string, string> = {
    texas_ercot: "US-TX", norway_hydro: "NO", virginia_pjm: "US-VA",
    iowa_miso: "US-IA", iceland_geo: "IS", singapore: "SG",
    us_west: "US-CA", us_east: "US-VA", europe: "EU", uk: "GB",
    germany: "DE", france: "FR", australia: "AU", japan: "JP",
    china: "CN", india: "IN", brazil: "BR", canada: "CA", global: "GLOBAL",
    US: "US", us: "US",
  };
  return map[region] || "GLOBAL";
}

// ─── Unit mappers ───────────────────────────────────────

function mapEnergyUnit(unit: string | null): string {
  if (!unit) return "kWh";
  const l = unit.toLowerCase();
  if (l.includes("gwh")) return "GWh";
  if (l.includes("mwh")) return "MWh";
  if (l.includes("gj")) return "GJ";
  if (l.includes("mj")) return "MJ";
  if (l.includes("tj")) return "TJ";
  if (l.includes("therm")) return "therm";
  return "kWh";
}

function mapWeightUnit(unit: string | null): string {
  if (!unit) return "kg";
  const l = unit.toLowerCase();
  if (l === "t" || l.includes("ton") || l.includes("mt")) return "t";
  if (l.includes("lb")) return "lb";
  if (l === "g" || l === "gram") return "g";
  return "kg";
}

function mapVolumeUnit(unit: string | null): string {
  if (!unit) return "l";
  const l = unit.toLowerCase();
  if (l.includes("m3") || l.includes("m³")) return "m3";
  if (l.includes("gal")) return "gallon_us";
  if (l.includes("bbl")) return "bbl";
  return "l";
}

function mapDistanceUnit(unit: string | null): string {
  if (!unit) return "km";
  const l = unit.toLowerCase();
  if (l.includes("mi")) return "mi";
  if (l === "m") return "m";
  return "km";
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
