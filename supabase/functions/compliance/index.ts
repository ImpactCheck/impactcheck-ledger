import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COMPLIANCE_PROMPT = `ROLE You are the Compliance Module for ImpactCheck v2. You are given: 1) The already-extracted activities (with regions, quantities, units, suppliers when available) 2) ImpactCheck computed outputs (CO2e totals, per-region totals, hotspots, confidence stats) 3) Any provided facility/company stats (energy/power numbers, location, revenue, "commercial operator" yes/no, etc.)
TASK Evaluate the regulation checklists (Norway, EU, USA, Iceland) using ONLY explicit values available in the provided inputs. Return ONE JSON object ONLY (no prose, no markdown, no explanations).
STRICT RULES (NO GUESSING)
Do not guess or estimate missing inputs.
Only use values explicitly provided in the inputs.
If a value is not present, set status = "MISSING".
If multiple conflicting values exist, status = "AMBIGUOUS" and do not evaluate dependent checks (set them to "MISSING").
Unit conversion is allowed ONLY if the unit is explicit and conversion is standard (kW↔MW, kWh↔MWh↔GWh). If unclear, mark AMBIGUOUS.
IMPORTANT ABOUT USA "DIRECT EMISSIONS"
"Annual direct facility emissions" means Scope 1 emissions for the facility (not total project CO2e).
If you only have ImpactCheck "total estimated emissions across activities" without an explicit label that it equals facility direct emissions, treat USA direct emissions input as MISSING.
PRIMARY JURISDICTION LOGIC
Always evaluate the primary jurisdiction.
Also evaluate other jurisdictions ONLY if at least one of their key inputs is present (otherwise return them as NOT_EVALUATED).
OUTPUT JSON SCHEMA (exact)
{
  "primary_jurisdiction": "<Norway|EU|USA|Iceland>",
  "jurisdictions": {
    "<JurisdictionName>": {
      "evaluation_status": "<EVALUATED|NOT_EVALUATED>",
      "inputs": {
        "<InputLine>": {
          "status": "<PRESENT|MISSING|AMBIGUOUS>",
          "value": "<number or string or null>",
          "unit": "<unit or null>",
          "source": "<where it came from or null>"
        }
      },
      "checks": {
        "<ChecklistLine>": {
          "status": "<PASS|FAIL|MISSING>",
          "computed_from": ["<InputLine>", "..."]
        }
      }
    }
  }
}
STATUS MEANINGS
inputs.status:
PRESENT = value is explicitly provided and unambiguous
MISSING = not found
AMBIGUOUS = conflicting/unclear
checks.status:
PASS = condition/threshold is met (e.g., "required if >= X" and value meets it)
FAIL = condition/threshold is not met
MISSING = cannot evaluate because required input(s) are missing/ambiguous
NORMALIZATION GUIDANCE
kW to MW: divide by 1000
MWh to GWh: divide by 1000
kWh to MWh: divide by 1000
If a doc says "capacity" but does not clarify subscribed vs supplied vs IT load, mark AMBIGUOUS.
CHECKLISTS (USE THESE STRINGS EXACTLY AS JSON KEYS)
NORWAY — Inputs
"Subscribed grid capacity for the site is provided (MW)"
"Total supplied electrical power to the site is provided (MW)"
"Annual energy use in Norway is provided (GWh/year)"
"Installed IT power demand is provided (kW)"
"Commercial data center operator is answered (Yes/No)"
NORWAY — Checks
"Registration required if commercial operator = Yes"
"Registration required if subscribed grid capacity > 0.5 MW"
"Mandatory energy mapping required if annual energy use ≥ 2.5 GWh/year"
"Waste-heat CBA required if total supplied electrical power > 2.0 MW"
"EU data center reporting in-scope if installed IT power demand ≥ 500 kW"
EU — Inputs
"Installed IT power demand is provided (kW)"
"Annual total data centre energy consumption is provided (MWh/year)"
"Annual IT equipment energy consumption is provided (MWh/year)"
"Average annual enterprise energy consumption over the previous 3 years is provided (TJ/year)"
"Energy management system status is provided (Yes/No)"
EU — Checks
"EU data centre reporting required if installed IT power demand ≥ 500 kW"
"EU best practices expected (encouraged) if installed IT power demand ≥ 1 MW"
"Energy management system required if average annual enterprise energy consumption > 85 TJ"
"Energy audit required if average annual enterprise energy consumption > 10 TJ and no energy management system"
"PUE must be reportable if annual total data centre energy + annual IT energy are provided"
USA — Inputs
"Facility location (state) is known"
"Annual direct greenhouse gas emissions for the facility are provided (metric tons CO2e/year)"
"Company annual revenue is provided (USD/year)"
"Doing business in California is answered (Yes/No)"
"Gross building floor area is provided (square feet)"
USA — Checks
"US federal GHG reporting required if annual facility direct emissions ≥ 25,000 metric tons CO2e/year"
"California facility GHG reporting likely required if the facility is in California and annual facility direct emissions ≥ 10,000 metric tons CO2e/year"
"California corporate GHG disclosures required if doing business in California = Yes and annual revenue > $1,000,000,000"
"Washington Clean Buildings Performance Standard applies if the building is in Washington and gross floor area > 50,000 sq ft"
ICELAND — Inputs
"Installed IT power demand is provided (kW)"
"Total rated thermal input of any on-site fuel combustion equipment is provided (MWth)"
"Electricity output of any on-site power installation is provided (MW)"
"Heat output of any on-site geothermal thermal power installation is provided (MWth)"
ICELAND — Checks
"Data center reporting in-scope if installed IT power demand ≥ 500 kW"
"EU ETS in-scope if total rated thermal input of fuel combustion installations > 20 MWth"
"Environmental Impact Assessment required if geothermal thermal power installation heat output ≥ 50 MW OR other power installation electricity output ≥ 10 MW"
"Environmental assessment screening required if hydropower station output ≥ 100 kW"
"Environmental assessment screening required if wind farm electricity output ≥ 2 MW OR geothermal heating production ≥ 2,500 kW gross power"
END. OUTPUT JSON ONLY.`;

function regionToJurisdiction(region: string): "Norway" | "EU" | "USA" | "Iceland" {
  const r = (region || "").toLowerCase();
  if (r === "norway") return "Norway";
  if (r === "eu") return "EU";
  if (r === "us") return "USA";
  if (r === "iceland") return "Iceland";
  return "USA";
}

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

    const { data: estimates } = await supabase
      .from("estimates")
      .select("*")
      .eq("project_id", projectId);

    const regions = [
      project?.primary_region,
      ...(project?.comparison_regions || []),
    ].filter(Boolean) as string[];

    if (regions.length === 0) {
      return new Response(
        JSON.stringify({
          byRegion: {},
          error: "No regions configured",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const byRegion: Record<string, unknown> = {};

    for (const regionKey of regions) {
      const regionEstimates = (estimates || []).filter(
        (e: any) => (e.region || "").toLowerCase() === regionKey.toLowerCase()
      );
      const totalCo2eKg = regionEstimates.reduce((s: number, e: any) => s + (e.co2e_kg || 0), 0);
      const totalCo2eTonnes = totalCo2eKg / 1000;

      const activitiesPayload = (activities || []).map((a: any) => ({
        text: a.text,
        region: a.region || regionKey,
        quantity: a.quantity,
        unit: a.unit,
        unit_type: a.unit_type,
        amount: a.amount,
        currency: a.currency,
        category: a.category,
      }));

      const hotspots = [...regionEstimates]
        .sort((a: any, b: any) => (b.co2e_kg || 0) - (a.co2e_kg || 0))
        .slice(0, 5)
        .map((e: any) => {
          const act = (activities || []).find((a: any) => a.id === e.activity_id);
          return { text: act?.text || "Unknown", co2eKg: e.co2e_kg };
        });

      const primaryJurisdiction = regionToJurisdiction(regionKey);

      const inputPayload = {
        region_evaluated: regionKey,
        primary_jurisdiction: primaryJurisdiction,
        activities: activitiesPayload,
        impactcheck_outputs: {
          total_estimated_emissions_kg_co2e: totalCo2eKg,
          total_estimated_emissions_metric_tons_co2e_per_year: totalCo2eTonnes,
          note: "Total estimated emissions across activities for this region. NOT necessarily facility direct (Scope 1) emissions.",
          hotspots,
          confidence: regionEstimates.length > 0
            ? regionEstimates.reduce((s: number, e: any) => s + (e.confidence || 0), 0) / regionEstimates.length
            : 0,
        },
        facility_company_stats: {},
      };

      const prompt = `${COMPLIANCE_PROMPT}\n\nINPUTS:\n${JSON.stringify(inputPayload, null, 2)}`;

      try {
        const geminiResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
            }),
          }
        );

        if (!geminiResp.ok) {
          const errText = await geminiResp.text();
          console.error("Gemini compliance error:", errText);
          byRegion[regionKey] = {
            error: "Compliance evaluation failed",
            primary_jurisdiction: primaryJurisdiction,
          };
          continue;
        }

        const geminiData = await geminiResp.json();
        let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
        rawText = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        // Extract the outermost JSON object robustly
        let parsed: Record<string, unknown> = {};
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          let jsonStr = jsonMatch[0];
          // Try parsing; if it fails, attempt to fix common LLM issues
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            // Fix trailing commas before } or ]
            jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
            // Fix unescaped newlines inside string values
            jsonStr = jsonStr.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, "\\n");
            try {
              parsed = JSON.parse(jsonStr);
            } catch (e2) {
              console.error("Failed to repair JSON:", e2);
            }
          }
        }

        byRegion[regionKey] = {
          ...parsed,
          totalCo2eKg,
          totalCo2eTonnes,
        };
      } catch (parseErr) {
        console.error("Compliance parse error for region", regionKey, parseErr);
        byRegion[regionKey] = {
          error: "Failed to parse compliance result",
          primary_jurisdiction: regionToJurisdiction(regionKey),
        };
      }
    }

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
