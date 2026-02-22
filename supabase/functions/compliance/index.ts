import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COMPLIANCE_PROMPT = `ROLE: You are the Compliance Module for ImpactCheck v2.

You receive extracted activities with regions, quantities, units, and ImpactCheck computed CO₂e outputs.

TASK: Evaluate the regulation checklists for the primary jurisdiction. Return ONE JSON object.

EVALUATION RULES:
1. BE CONFIDENT: When data clearly indicates a value (e.g., energy consumption from activities, total emissions), USE IT to evaluate checks. Do not mark as MISSING when a reasonable value can be derived.
2. Total estimated emissions from ImpactCheck CAN be used as a proxy for facility emissions when the activities describe facility-level operations. Mark the input as PRESENT with a note about the source.
3. If activities describe energy consumption (kWh, MWh, GWh), derive power demand and energy totals from them. Convert units as needed.
4. Only mark as MISSING when there is genuinely NO data available — not when data requires simple derivation or unit conversion.
5. When a threshold check cannot be evaluated, prefer FAIL (below threshold/not applicable) over MISSING if the available data suggests the facility is small/below thresholds.
6. Unit conversions are always allowed: kW↔MW, kWh↔MWh↔GWh, TJ↔MWh (1 TJ = 277.78 MWh).

PRIMARY JURISDICTION: Set "primary_jurisdiction" to the jurisdiction matching the region being evaluated.
Evaluate the primary jurisdiction fully. Evaluate other jurisdictions ONLY if relevant inputs are present, otherwise set evaluation_status to "NOT_EVALUATED".

OUTPUT JSON SCHEMA (exact):
{
  "primary_jurisdiction": "<Norway|EU|USA|Iceland>",
  "jurisdictions": {
    "<JurisdictionName>": {
      "evaluation_status": "<EVALUATED|NOT_EVALUATED>",
      "inputs": {
        "<InputLine>": {
          "status": "<PRESENT|MISSING>",
          "value": "<number or string or null>",
          "unit": "<unit or null>",
          "source": "<description of where the value came from>"
        }
      },
      "checks": {
        "<ChecklistLine>": {
          "status": "<PASS|FAIL|MISSING>",
          "computed_from": ["<InputLine>"]
        }
      }
    }
  }
}

CHECK STATUS MEANINGS:
- PASS = the regulatory condition IS triggered (e.g., emissions exceed threshold, so reporting IS required)
- FAIL = the regulatory condition is NOT triggered (e.g., emissions below threshold, reporting not required)
- MISSING = truly cannot evaluate (no data at all, not even derivable)

CHECKLISTS (USE THESE STRINGS EXACTLY AS JSON KEYS):

NORWAY — Inputs:
"Subscribed grid capacity for the site is provided (MW)"
"Total supplied electrical power to the site is provided (MW)"
"Annual energy use in Norway is provided (GWh/year)"
"Installed IT power demand is provided (kW)"
"Commercial data center operator is answered (Yes/No)"

NORWAY — Checks:
"Registration required if commercial operator = Yes"
"Registration required if subscribed grid capacity > 0.5 MW"
"Mandatory energy mapping required if annual energy use >= 2.5 GWh/year"
"Waste-heat CBA required if total supplied electrical power > 2.0 MW"
"EU data center reporting in-scope if installed IT power demand >= 500 kW"

EU — Inputs:
"Installed IT power demand is provided (kW)"
"Annual total data centre energy consumption is provided (MWh/year)"
"Annual IT equipment energy consumption is provided (MWh/year)"
"Average annual enterprise energy consumption over the previous 3 years is provided (TJ/year)"
"Energy management system status is provided (Yes/No)"

EU — Checks:
"EU data centre reporting required if installed IT power demand >= 500 kW"
"EU best practices expected (encouraged) if installed IT power demand >= 1 MW"
"Energy management system required if average annual enterprise energy consumption > 85 TJ"
"Energy audit required if average annual enterprise energy consumption > 10 TJ and no energy management system"
"PUE must be reportable if annual total data centre energy + annual IT energy are provided"

USA — Inputs:
"Facility location (state) is known"
"Annual direct greenhouse gas emissions for the facility are provided (metric tons CO2e/year)"
"Company annual revenue is provided (USD/year)"
"Doing business in California is answered (Yes/No)"
"Gross building floor area is provided (square feet)"

USA — Checks:
"US federal GHG reporting required if annual facility direct emissions >= 25,000 metric tons CO2e/year"
"California facility GHG reporting likely required if the facility is in California and annual facility direct emissions >= 10,000 metric tons CO2e/year"
"California corporate GHG disclosures required if doing business in California = Yes and annual revenue > $1,000,000,000"
"Washington Clean Buildings Performance Standard applies if the building is in Washington and gross floor area > 50,000 sq ft"

ICELAND — Inputs:
"Installed IT power demand is provided (kW)"
"Total rated thermal input of any on-site fuel combustion equipment is provided (MWth)"
"Electricity output of any on-site power installation is provided (MW)"
"Heat output of any on-site geothermal thermal power installation is provided (MWth)"

ICELAND — Checks:
"Data center reporting in-scope if installed IT power demand >= 500 kW"
"EU ETS in-scope if total rated thermal input of fuel combustion installations > 20 MWth"
"Environmental Impact Assessment required if geothermal thermal power installation heat output >= 50 MW OR other power installation electricity output >= 10 MW"
"Environmental assessment screening required if hydropower station output >= 100 kW"
"Environmental assessment screening required if wind farm electricity output >= 2 MW OR geothermal heating production >= 2,500 kW gross power"

OUTPUT JSON ONLY. No prose, no markdown fences.`;

// Categories considered "embodied" (one-time, year-1 only)
const EMBODIED_CATEGORIES = [
  "HARDWARE", "CONSTRUCTION", "PROCUREMENT", "MANUFACTURING",
  "INFRASTRUCTURE", "EQUIPMENT", "INSTALLATION", "CAPEX", "MATERIAL",
  "NETWORK_HARDWARE", "COOLING_EQUIPMENT", "ELECTRICAL", "CIVIL",
];

function isEmbodiedCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const upper = category.toUpperCase();
  return EMBODIED_CATEGORIES.some((c) => upper.includes(c));
}

function regionToJurisdiction(region: string): "Norway" | "EU" | "USA" | "Iceland" {
  const r = (region || "").toUpperCase();
  if (r === "NO" || r.includes("NORWAY")) return "Norway";
  if (r === "EU" || r.includes("EUROPE")) return "EU";
  if (r === "US" || r === "USA" || r.includes("UNITED STATES")) return "USA";
  if (r === "IS" || r.includes("ICELAND")) return "Iceland";
  // Map other European country codes to EU
  const euCodes = ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "SE", "DK", "FI", "PT", "IE", "PL", "CZ", "RO", "BG", "HR", "SK", "SI", "LT", "LV", "EE", "LU", "MT", "CY", "HU", "GR"];
  if (euCodes.includes(r)) return "EU";
  return "USA";
}

/** Robustly parse LLM-generated compliance JSON, repairing common truncation/malformation. */
function parseComplianceJson(
  rawText: string,
  periodLabel: string,
  regionKey: string
): Record<string, unknown> {
  const tryParse = (text: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  let candidate = rawText;
  let result = tryParse(candidate);
  if (result) return result;

  // Extract JSON object (may be wrapped in markdown or prose)
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (jsonMatch) candidate = jsonMatch[0];

  result = tryParse(candidate);
  if (result) return result;

  // Fix trailing commas (common LLM error)
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");
  result = tryParse(candidate);
  if (result) return result;

  // Fix truncated property values: "status": } or "status": , (no value)
  const incompleteKeys = ["status", "value", "unit", "source", "evaluation_status", "computed_from"];
  for (const key of incompleteKeys) {
    const re = new RegExp(`"${key}"\\s*:\\s*([,}])`, "g");
    candidate = candidate.replace(re, `"${key}": null$1`);
  }
  // computed_from expects array, not null
  candidate = candidate.replace(/"computed_from"\s*:\s*null/g, '"computed_from": []');

  result = tryParse(candidate);
  if (result) return result;

  // Fix truncation at end: "status": or "key": with nothing after — complete and close
  const incompleteAtEnd = /("(?:status|value|unit|source|evaluation_status)")\s*:\s*$/;
  const computedFromAtEnd = /"computed_from"\s*:\s*$/;
  if (incompleteAtEnd.test(candidate)) {
    candidate = candidate.replace(incompleteAtEnd, "$1: null");
    const openBraces = (candidate.match(/\{/g) || []).length - (candidate.match(/\}/g) || []).length;
    const openBrackets = (candidate.match(/\[/g) || []).length - (candidate.match(/\]/g) || []).length;
    candidate += "}".repeat(Math.max(0, openBraces)) + "]".repeat(Math.max(0, openBrackets));
    result = tryParse(candidate);
    if (result) return result;
  } else if (computedFromAtEnd.test(candidate)) {
    candidate = candidate.replace(computedFromAtEnd, '"computed_from": []');
    const openBraces = (candidate.match(/\{/g) || []).length - (candidate.match(/\}/g) || []).length;
    const openBrackets = (candidate.match(/\[/g) || []).length - (candidate.match(/\]/g) || []).length;
    candidate += "}".repeat(Math.max(0, openBraces)) + "]".repeat(Math.max(0, openBrackets));
    result = tryParse(candidate);
    if (result) return result;
  }

  // Try truncation repair: find last complete object boundary and close structure
  const lastBrace = candidate.lastIndexOf("}");
  if (lastBrace > 100) {
    const truncated = candidate.slice(0, lastBrace + 1);
    result = tryParse(truncated);
    if (result) return result;
  }

  console.error(
    `JSON parse error (${periodLabel}, ${regionKey}): Raw:`,
    rawText.substring(0, 500)
  );
  return {};
}

async function evaluateCompliance(
  geminiApiKey: string,
  regionKey: string,
  periodLabel: string,
  activities: any[],
  estimates: any[],
  allActivities: any[],
): Promise<Record<string, unknown>> {
  const totalCo2eKg = estimates.reduce((s: number, e: any) => s + (e.co2e_kg || 0), 0);
  const totalCo2eTonnes = totalCo2eKg / 1000;

  const activitiesPayload = activities.map((a: any) => ({
    text: a.text,
    region: a.region || regionKey,
    quantity: a.quantity,
    unit: a.unit,
    unit_type: a.unit_type,
    amount: a.amount,
    currency: a.currency,
    category: a.category,
  }));

  const hotspots = [...estimates]
    .sort((a: any, b: any) => (b.co2e_kg || 0) - (a.co2e_kg || 0))
    .slice(0, 5)
    .map((e: any) => {
      const act = allActivities.find((a: any) => a.id === e.activity_id);
      return { text: act?.text || "Unknown", co2eKg: e.co2e_kg };
    });

  const primaryJurisdiction = regionToJurisdiction(regionKey);

  const inputPayload = {
    region_evaluated: regionKey,
    region_jurisdiction: primaryJurisdiction,
    period: periodLabel,
    primary_jurisdiction: primaryJurisdiction,
    activities: activitiesPayload,
    impactcheck_outputs: {
      total_estimated_emissions_kg_co2e: totalCo2eKg,
      total_estimated_emissions_metric_tons_co2e_per_year: totalCo2eTonnes,
      hotspots,
      activity_count: activities.length,
      estimate_count: estimates.length,
    },
  };

  const prompt = `${COMPLIANCE_PROMPT}\n\nEVALUATION CONTEXT:\n- Region: ${regionKey} → Primary Jurisdiction: ${primaryJurisdiction}\n- Period: ${periodLabel}\n- "Year 1" includes embodied (construction/hardware) + operational emissions.\n- "Following Years" includes only ongoing operational emissions.\n\nINPUTS:\n${JSON.stringify(inputPayload, null, 2)}`;

  try {
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.05,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error(`Gemini compliance error (${periodLabel}, ${regionKey}):`, errText);
      return {
        error: "Compliance evaluation failed",
        primary_jurisdiction: primaryJurisdiction,
      };
    }

    const geminiData = await geminiResp.json();
    let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    rawText = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    const parsed = parseComplianceJson(rawText, periodLabel, regionKey);

    return {
      ...parsed,
      totalCo2eKg,
      totalCo2eTonnes,
    };
  } catch (err) {
    console.error(`Compliance evaluation error (${periodLabel}, ${regionKey}):`, err);
    return {
      error: "Compliance evaluation failed",
      primary_jurisdiction: regionToJurisdiction(regionKey),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: { projectId?: string; forceRefresh?: boolean };
    try {
      const text = await req.text();
      if (!text || text.trim() === "") {
        return new Response(
          JSON.stringify({ error: "Request body is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      body = JSON.parse(text);
    } catch (e) {
      if (e instanceof SyntaxError) {
        return new Response(
          JSON.stringify({ error: "Invalid JSON in request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw e;
    }

    const { projectId, forceRefresh } = body;
    if (!projectId) throw new Error("projectId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Return cached evaluation if available and not forcing refresh
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("compliance_evaluations")
        .select("by_region")
        .eq("project_id", projectId)
        .maybeSingle();
      if (cached?.by_region && Object.keys(cached.by_region as object).length > 0) {
        return new Response(JSON.stringify({ byRegion: cached.by_region }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const { data: project } = await supabase
      .from("projects")
      .select("primary_region, comparison_regions, name, year")
      .eq("id", projectId)
      .single();

    const { data: activities } = await supabase
      .from("activities")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    // Fetch BOTH primary estimates and simulation estimates
    const [{ data: estimates }, { data: simEstimates }] = await Promise.all([
      supabase.from("estimates").select("*").eq("project_id", projectId),
      supabase.from("simulation_estimates").select("*").eq("project_id", projectId),
    ]);

    const primaryRegion = project?.primary_region;
    const comparisonRegions = project?.comparison_regions || [];
    const regions = [primaryRegion, ...comparisonRegions].filter(Boolean) as string[];

    if (regions.length === 0) {
      return new Response(
        JSON.stringify({ byRegion: {}, error: "No regions configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build activity lookup
    const activityMap = new Map<string, any>();
    for (const a of (activities || [])) {
      activityMap.set(a.id, a);
    }

    const byRegion: Record<string, unknown> = {};

    const regionPromises = regions.map(async (regionKey) => {
      // For primary region, use `estimates` table
      // For comparison regions, use `simulation_estimates` table filtered by simulation_region
      const isPrimary = regionKey === primaryRegion;
      let regionEstimates: any[];

      if (isPrimary) {
        regionEstimates = (estimates || []).filter(
          (e: any) => (e.region || "").toLowerCase() === regionKey.toLowerCase()
        );
      } else {
        regionEstimates = (simEstimates || []).filter(
          (e: any) => (e.simulation_region || "").toLowerCase() === regionKey.toLowerCase()
        );
      }

      // Split by phase
      const year1Estimates = regionEstimates;
      const ongoingEstimates = regionEstimates.filter((e: any) => {
        const act = activityMap.get(e.activity_id);
        return !isEmbodiedCategory(act?.category);
      });

      const allActs = activities || [];
      const ongoingActivities = allActs.filter((a: any) => !isEmbodiedCategory(a.category));

      try {
        const [year1Result, ongoingResult] = await Promise.all([
          evaluateCompliance(GEMINI_API_KEY, regionKey, "Year 1", allActs, year1Estimates, allActs),
          evaluateCompliance(GEMINI_API_KEY, regionKey, "Following Years", ongoingActivities, ongoingEstimates, allActs),
        ]);

        byRegion[regionKey] = {
          year1: year1Result,
          ongoing: ongoingResult,
        };
      } catch (err) {
        console.error("Compliance error for region", regionKey, err);
        byRegion[regionKey] = {
          year1: { error: "Failed to evaluate", primary_jurisdiction: regionToJurisdiction(regionKey) },
          ongoing: { error: "Failed to evaluate", primary_jurisdiction: regionToJurisdiction(regionKey) },
        };
      }
    });

    await Promise.all(regionPromises);

    // Persist evaluation for the project
    await supabase
      .from("compliance_evaluations")
      .upsert(
        {
          project_id: projectId,
          by_region: byRegion,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id" }
      );

    return new Response(JSON.stringify({ byRegion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compliance error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
