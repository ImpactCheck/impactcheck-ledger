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

    // Get project for region info
    const { data: proj } = await supabase.from("projects").select("primary_region").eq("id", projectId).single();
    const climatiqRegion = mapRegionToClimatiq(proj?.primary_region || "");

    await supabase.from("jobs").update({ progress: 20, stage: "searching emission factors" }).eq("id", job.id);

    // Delete old estimates
    await supabase.from("estimates").delete().eq("project_id", projectId);

    const estimates: any[] = [];
    const total = activities.length;

    for (let i = 0; i < total; i++) {
      const act = activities[i];
      const progress = 20 + Math.floor((i / total) * 65);
      await supabase.from("jobs").update({ progress, stage: `Mapping ${i + 1}/${total}: ${act.search_query || act.text}` }).eq("id", job.id);

      try {
        // Step 1: Search Climatiq for matching emission factors using search_query
        const searchQuery = act.search_query || act.text;
        const searchParams = new URLSearchParams({
          query: searchQuery,
          results_per_page: "5",
        });

        // Add unit_type filter if available
        if (act.unit_type) {
          searchParams.set("unit_type", act.unit_type);
        }

        // Add region filter
        if (climatiqRegion && climatiqRegion !== "GLOBAL") {
          searchParams.set("region", climatiqRegion);
        }

        const searchResp = await fetch(
          `https://api.climatiq.io/search?${searchParams.toString()}`,
          { headers: { Authorization: `Bearer ${CLIMATIQ_API_KEY}` } }
        );

        if (!searchResp.ok) {
          const errText = await searchResp.text();
          console.error(`Search failed for "${searchQuery}":`, errText);
          estimates.push(fallbackEstimate(projectId, act, null));
          continue;
        }

        const searchData = await searchResp.json();
        const factors = searchData.results || [];

        if (factors.length === 0) {
          // Retry without region filter
          const retryParams = new URLSearchParams({
            query: searchQuery,
            results_per_page: "5",
          });
          if (act.unit_type) retryParams.set("unit_type", act.unit_type);

          const retrySearchResp = await fetch(
            `https://api.climatiq.io/search?${retryParams.toString()}`,
            { headers: { Authorization: `Bearer ${CLIMATIQ_API_KEY}` } }
          );

          if (retrySearchResp.ok) {
            const retryData = await retrySearchResp.json();
            if (retryData.results?.length > 0) {
              factors.push(...retryData.results);
            }
          } else {
            await retrySearchResp.text(); // consume body
          }
        }

        if (factors.length === 0) {
          // Final retry: broaden search without unit_type
          const broadParams = new URLSearchParams({
            query: searchQuery,
            results_per_page: "3",
          });

          const broadResp = await fetch(
            `https://api.climatiq.io/search?${broadParams.toString()}`,
            { headers: { Authorization: `Bearer ${CLIMATIQ_API_KEY}` } }
          );

          if (broadResp.ok) {
            const broadData = await broadResp.json();
            if (broadData.results?.length > 0) {
              factors.push(...broadData.results);
            }
          } else {
            await broadResp.text();
          }
        }

        if (factors.length === 0) {
          console.warn(`No factors found for "${searchQuery}"`);
          estimates.push(fallbackEstimate(projectId, act, null));
          continue;
        }

        // Step 2: Pick the best factor and build estimate parameters
        const bestFactor = pickBestFactor(factors, act);

        // Step 3: Build estimation request
        const estimateBody: any = {
          emission_factor: {
            activity_id: bestFactor.activity_id,
          },
          parameters: buildParameters(act, bestFactor),
        };

        // Add region to emission factor if available
        if (climatiqRegion && climatiqRegion !== "GLOBAL") {
          estimateBody.emission_factor.region = climatiqRegion;
        }

        const estimateResp = await fetch("https://api.climatiq.io/estimate", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CLIMATIQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(estimateBody),
        });

        if (estimateResp.ok) {
          const data = await estimateResp.json();
          estimates.push({
            project_id: projectId,
            activity_id: act.id,
            region: act.region,
            matched_factor: {
              id: data.emission_factor?.id || bestFactor.activity_id,
              name: data.emission_factor?.name || bestFactor.name,
              source: data.emission_factor?.source || bestFactor.source,
              year: data.emission_factor?.year || bestFactor.year,
              unit: bestFactor.unit_type?.[0] || act.unit_type,
            },
            confidence: 0.85,
            co2e_kg: data.co2e || 0,
            input_used: {
              unit_type: act.unit_type,
              quantity: act.quantity,
              amount: act.amount,
              currency: act.currency,
            },
          });
        } else {
          // Estimate failed — try without region constraint
          const retryEstBody: any = {
            emission_factor: { activity_id: bestFactor.activity_id },
            parameters: buildParameters(act, bestFactor),
          };

          const retryEstResp = await fetch("https://api.climatiq.io/estimate", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${CLIMATIQ_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(retryEstBody),
          });

          if (retryEstResp.ok) {
            const retryData = await retryEstResp.json();
            estimates.push({
              project_id: projectId,
              activity_id: act.id,
              region: act.region,
              matched_factor: {
                id: retryData.emission_factor?.id || bestFactor.activity_id,
                name: retryData.emission_factor?.name || bestFactor.name,
                source: retryData.emission_factor?.source || bestFactor.source,
                year: retryData.emission_factor?.year,
                unit: bestFactor.unit_type?.[0] || act.unit_type,
              },
              confidence: 0.7,
              co2e_kg: retryData.co2e || 0,
              input_used: { unit_type: act.unit_type, quantity: act.quantity, amount: act.amount, currency: act.currency },
            });
          } else {
            const errText = await retryEstResp.text();
            console.error(`Estimate failed for factor ${bestFactor.activity_id}:`, errText);
            estimates.push(fallbackEstimate(projectId, act, bestFactor));
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

    const succeeded = estimates.filter((e) => e.co2e_kg > 0).length;

    await supabase.from("jobs").update({
      status: "succeeded",
      progress: 100,
      stage: "complete",
      message: `Mapped ${estimates.length} activities (${succeeded} with estimates)`,
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

// ─── Helpers ──────────────────────────────────────────────

function pickBestFactor(factors: any[], act: any): any {
  // Prefer factors that match the unit_type
  if (act.unit_type) {
    const unitMatch = factors.find((f: any) =>
      f.unit_type?.some((u: string) => u.toLowerCase() === act.unit_type.toLowerCase())
    );
    if (unitMatch) return unitMatch;
  }
  // Otherwise return the first (most relevant by Climatiq ranking)
  return factors[0];
}

function buildParameters(act: any, factor: any): any {
  const factorUnitTypes: string[] = (factor.unit_type || []).map((u: string) => u.toLowerCase());

  // Try to match activity data to what the factor expects
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
    // Convert power to energy assuming 1 year operation (8760 hours)
    const kw = act.unit?.toLowerCase().includes("mw") ? act.quantity * 1000 : act.quantity;
    return { energy: kw * 8760, energy_unit: "kWh" };
  }

  // Fallback: try to use whatever we have
  if (act.quantity) {
    // Check what the factor expects
    if (factorUnitTypes.includes("weight")) {
      return { weight: act.quantity, weight_unit: mapWeightUnit(act.unit) };
    }
    if (factorUnitTypes.includes("energy")) {
      return { energy: act.quantity, energy_unit: mapEnergyUnit(act.unit) };
    }
    if (factorUnitTypes.includes("money")) {
      return { money: act.quantity, money_unit: (act.currency || "usd").toLowerCase() };
    }
    if (factorUnitTypes.includes("volume")) {
      return { volume: act.quantity, volume_unit: mapVolumeUnit(act.unit) };
    }
    if (factorUnitTypes.includes("number")) {
      return { number: act.quantity };
    }
    // Default to weight
    return { weight: act.quantity, weight_unit: mapWeightUnit(act.unit) };
  }

  // Last resort: monetary fallback
  if (act.amount) {
    return { money: act.amount, money_unit: (act.currency || "usd").toLowerCase() };
  }

  // Absolute fallback
  if (factorUnitTypes.includes("money")) {
    return { money: 1000, money_unit: "usd" };
  }
  return { weight: 1, weight_unit: "kg" };
}

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
      unit: factor?.unit_type?.[0] || null,
    },
    confidence: 0.2,
    co2e_kg: 0,
    input_used: { unit_type: act.unit_type, quantity: act.quantity, amount: act.amount, currency: act.currency },
  };
}

function mapRegionToClimatiq(region: string): string {
  const map: Record<string, string> = {
    texas_ercot: "US-TX",
    norway_hydro: "NO",
    virginia_pjm: "US-VA",
    iowa_miso: "US-IA",
    iceland_geo: "IS",
    singapore: "SG",
    us_west: "US-CA",
    us_east: "US-VA",
    europe: "EU",
    uk: "GB",
    germany: "DE",
    france: "FR",
    australia: "AU",
    japan: "JP",
    china: "CN",
    india: "IN",
    brazil: "BR",
    canada: "CA",
    global: "GLOBAL",
  };
  return map[region] || "GLOBAL";
}

function mapEnergyUnit(unit: string | null): string {
  if (!unit) return "kWh";
  const lower = unit.toLowerCase();
  if (lower.includes("gwh")) return "GWh";
  if (lower.includes("mwh")) return "MWh";
  if (lower.includes("mj")) return "MJ";
  if (lower.includes("gj")) return "GJ";
  if (lower.includes("tj")) return "TJ";
  if (lower.includes("therm")) return "therm";
  return "kWh";
}

function mapWeightUnit(unit: string | null): string {
  if (!unit) return "kg";
  const lower = unit.toLowerCase();
  if (lower === "t" || lower.includes("ton") || lower.includes("mt")) return "t";
  if (lower.includes("lb")) return "lb";
  if (lower === "g" || lower === "gram") return "g";
  return "kg";
}

function mapVolumeUnit(unit: string | null): string {
  if (!unit) return "l";
  const lower = unit.toLowerCase();
  if (lower.includes("m3") || lower.includes("m³")) return "m3";
  if (lower.includes("gal")) return "gal";
  if (lower.includes("bbl")) return "bbl";
  return "l";
}

function mapDistanceUnit(unit: string | null): string {
  if (!unit) return "km";
  const lower = unit.toLowerCase();
  if (lower.includes("mi")) return "mi";
  if (lower === "m") return "m";
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
