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

    const CLIMATIQ_API_KEY = Deno.env.get("CLIMATIQ_API_KEY");
    if (!CLIMATIQ_API_KEY) throw new Error("CLIMATIQ_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({ project_id: projectId, type: "mapping", status: "running", progress: 10, stage: "initializing" })
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

    await supabase.from("jobs").update({ progress: 20, stage: "mapping activities" }).eq("id", job.id);

    // Delete old estimates
    await supabase.from("estimates").delete().eq("project_id", projectId);

    const estimates: any[] = [];
    const total = activities.length;

    for (let i = 0; i < total; i++) {
      const act = activities[i];
      const progress = 20 + Math.floor((i / total) * 60);
      await supabase.from("jobs").update({ progress, stage: `Mapping ${i + 1}/${total}` }).eq("id", job.id);

      try {
        // Use Climatiq estimation API
        const body: any = {
          emission_factor: {
            activity_id: mapActivityToClimatiq(act.text, act.unit_type),
          },
        };

        // Set parameters based on unit type
        if (act.unit_type === "Money" && act.amount) {
          body.parameters = { money: act.amount, money_unit: act.currency?.toLowerCase() || "usd" };
        } else if (act.unit_type === "Energy" && act.quantity) {
          body.parameters = { energy: act.quantity, energy_unit: mapEnergyUnit(act.unit) };
        } else if (act.unit_type === "Weight" && act.quantity) {
          body.parameters = { weight: act.quantity, weight_unit: mapWeightUnit(act.unit) };
        } else if (act.unit_type === "Distance" && act.quantity) {
          body.parameters = { distance: act.quantity, distance_unit: mapDistanceUnit(act.unit) };
        } else if (act.quantity) {
          body.parameters = { weight: act.quantity, weight_unit: "kg" };
        } else {
          // Fallback: use money-based estimate
          body.parameters = { money: 1000, money_unit: "usd" };
        }

        if (act.region) {
          body.emission_factor.region = mapRegionToClimatiq(act.region);
        }

        const climatiqResp = await fetch("https://api.climatiq.io/estimate", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CLIMATIQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (climatiqResp.ok) {
          const data = await climatiqResp.json();
          estimates.push({
            project_id: projectId,
            activity_id: act.id,
            region: act.region,
            matched_factor: {
              id: data.emission_factor?.id || "unknown",
              name: data.emission_factor?.name || act.text,
              source: data.emission_factor?.source || "Climatiq",
              year: data.emission_factor?.year,
              unit: data.emission_factor?.unit,
            },
            confidence: data.emission_factor?.id ? 0.85 : 0.5,
            co2e_kg: data.co2e || 0,
            input_used: {
              unit_type: act.unit_type,
              quantity: act.quantity,
              amount: act.amount,
            },
          });
        } else {
          // Fallback: use a simple search to find factors
          const searchResp = await fetch(
            `https://api.climatiq.io/search?query=${encodeURIComponent(act.text)}&results_per_page=1`,
            {
              headers: { Authorization: `Bearer ${CLIMATIQ_API_KEY}` },
            }
          );

          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const factor = searchData.results?.[0];
            if (factor) {
              // Try estimate with found factor
              const retryBody: any = {
                emission_factor: { activity_id: factor.activity_id },
                parameters: body.parameters,
              };
              const retryResp = await fetch("https://api.climatiq.io/estimate", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${CLIMATIQ_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(retryBody),
              });

              if (retryResp.ok) {
                const retryData = await retryResp.json();
                estimates.push({
                  project_id: projectId,
                  activity_id: act.id,
                  region: act.region,
                  matched_factor: {
                    id: factor.activity_id || "unknown",
                    name: factor.name || act.text,
                    source: factor.source || "Climatiq",
                    year: factor.year,
                    unit: factor.unit,
                  },
                  confidence: 0.6,
                  co2e_kg: retryData.co2e || 0,
                  input_used: { unit_type: act.unit_type, quantity: act.quantity, amount: act.amount },
                });
              } else {
                // Add with zero estimate
                estimates.push(fallbackEstimate(projectId, act, factor));
              }
            } else {
              estimates.push(fallbackEstimate(projectId, act, null));
            }
          } else {
            estimates.push(fallbackEstimate(projectId, act, null));
          }
        }
      } catch (err) {
        console.error(`Error mapping activity ${act.id}:`, err);
        estimates.push(fallbackEstimate(projectId, act, null));
      }
    }

    // Insert estimates
    if (estimates.length > 0) {
      await supabase.from("estimates").insert(estimates);
    }

    await supabase.from("jobs").update({
      status: "succeeded",
      progress: 100,
      stage: "complete",
      message: `Mapped ${estimates.length} activities`,
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

function fallbackEstimate(projectId: string, act: any, factor: any) {
  return {
    project_id: projectId,
    activity_id: act.id,
    region: act.region,
    matched_factor: {
      id: factor?.activity_id || "unmatched",
      name: factor?.name || "No factor matched",
      source: factor?.source || "N/A",
      year: factor?.year,
      unit: factor?.unit,
    },
    confidence: 0.3,
    co2e_kg: 0,
    input_used: { unit_type: act.unit_type, quantity: act.quantity, amount: act.amount },
  };
}

function mapActivityToClimatiq(text: string, unitType: string | null): string {
  const lower = text.toLowerCase();
  if (lower.includes("electricity") || lower.includes("grid")) return "electricity-supply_grid-source_supplier_mix";
  if (lower.includes("diesel") || lower.includes("generator")) return "fuel_type_diesel-fuel_use_stationary_combustion";
  if (lower.includes("concrete")) return "construction_material-type_concrete";
  if (lower.includes("steel") || lower.includes("rebar")) return "construction_material-type_steel";
  if (lower.includes("commut")) return "passenger_vehicle-vehicle_type_car-fuel_source_na";
  if (lower.includes("cooling") || lower.includes("hvac")) return "electricity-supply_grid-source_supplier_mix";
  if (lower.includes("fiber") || lower.includes("cable")) return "electrical_equipment-type_cable";
  if (lower.includes("battery") || lower.includes("ups")) return "electrical_equipment-type_battery";
  if (lower.includes("server") || lower.includes("gpu") || lower.includes("nvidia")) return "electrical_equipment-type_server";
  if (lower.includes("transport") || lower.includes("shipping")) return "freight_vehicle-vehicle_type_hgv-fuel_source_na";
  return "electricity-supply_grid-source_supplier_mix";
}

function mapRegionToClimatiq(region: string): string {
  const map: Record<string, string> = {
    texas_ercot: "US-TX",
    norway_hydro: "NO",
    virginia_pjm: "US-VA",
    iowa_miso: "US-IA",
    iceland_geo: "IS",
    singapore: "SG",
  };
  return map[region] || "GLOBAL";
}

function mapEnergyUnit(unit: string | null): string {
  if (!unit) return "kWh";
  const lower = unit.toLowerCase();
  if (lower.includes("mwh")) return "MWh";
  if (lower.includes("gwh")) return "GWh";
  return "kWh";
}

function mapWeightUnit(unit: string | null): string {
  if (!unit) return "kg";
  const lower = unit.toLowerCase();
  if (lower.includes("mt") || lower.includes("ton")) return "t";
  return "kg";
}

function mapDistanceUnit(unit: string | null): string {
  if (!unit) return "km";
  const lower = unit.toLowerCase();
  if (lower.includes("mi")) return "mi";
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
