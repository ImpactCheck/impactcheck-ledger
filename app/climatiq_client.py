"""
Climatiq Data API v1 client: search, single estimate, batch estimate.
Uses CLIMATIQ_API_KEY; stub mode when key is missing.
"""
from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

DATA_VERSION = "^21"
BASE_URL = "https://api.climatiq.io/data/v1"

logger = logging.getLogger(__name__)


def _get_api_key() -> str | None:
    return os.environ.get("CLIMATIQ_API_KEY") or None


def _is_stub() -> bool:
    return _get_api_key() is None


# ─── Region mapping (align with Supabase mapping) ────────────────────────

REGION_TO_CLIMATIQ: dict[str, str] = {
    "texas_ercot": "US-TX",
    "norway_hydro": "NO",
    "virginia_pjm": "US-VA",
    "iowa_miso": "US-IA",
    "iceland_geo": "IS",
    "singapore": "SG",
    "us_west": "US-CA",
    "us_east": "US-VA",
    "europe": "EU",
    "uk": "GB",
    "germany": "DE",
    "france": "FR",
    "australia": "AU",
    "japan": "JP",
    "china": "CN",
    "india": "IN",
    "brazil": "BR",
    "canada": "CA",
    "global": "GLOBAL",
}


def map_region_to_climatiq(region: str) -> str:
    if not region:
        return "GLOBAL"
    key = region.lower().strip()
    return REGION_TO_CLIMATIQ.get(key, "GLOBAL")


# ─── Retries ─────────────────────────────────────────────────────────────

def _request_with_retry(
    url: str,
    method: str = "GET",
    body: dict | None = None,
    headers: dict | None = None,
    max_retries: int = 4,
) -> tuple[int, dict | None, str | None]:
    """
    Return (status_code, response_json_or_none, error_message).
    On 429 or 5xx, exponential backoff 1s, 2s, 4s, 8s.
    """
    req_headers = {"Content-Type": "application/json", **(headers or {})}
    delay = 1.0
    last_error: str | None = None
    last_status = 0

    for attempt in range(max_retries + 1):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(body).encode() if body else None,
                headers=req_headers,
                method=method,
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read().decode()
                return (resp.status, json.loads(data) if data else None, None)
        except urllib.error.HTTPError as e:
            last_status = e.code
            last_error = e.read().decode() if e.fp else str(e)
            if e.code == 429 or (500 <= e.code < 600):
                if attempt < max_retries:
                    logger.warning(
                        "Climatiq retry %s/%s for %s (status %s), waiting %.0fs",
                        attempt + 1, max_retries, url, e.code, delay,
                    )
                    time.sleep(delay)
                    delay *= 2
                    continue
            return (e.code, None, last_error)
        except Exception as e:
            last_error = str(e)
            if attempt < max_retries:
                time.sleep(delay)
                delay *= 2
                continue
            return (0, None, last_error)

    return (last_status, None, last_error or "Unknown error")


# ─── Parameter mapping (unit_type → param_key, unit_key, normalization) ──

def _map_energy_unit(unit: str | None) -> str:
    if not unit:
        return "kWh"
    u = unit.lower()
    if "gwh" in u:
        return "GWh"
    if "mwh" in u:
        return "MWh"
    if "gj" in u:
        return "GJ"
    if "mj" in u:
        return "MJ"
    if "tj" in u:
        return "TJ"
    if "therm" in u:
        return "therm"
    return "kWh"


def _map_weight_unit(unit: str | None) -> str:
    if not unit:
        return "kg"
    u = unit.lower()
    if u in ("t", "ton", "tonne") or "ton" in u or "mt" in u:
        return "t"
    if "lb" in u:
        return "lb"
    if u in ("g", "gram"):
        return "g"
    return "kg"


def _map_volume_unit(unit: str | None) -> str:
    if not unit:
        return "l"
    u = unit.lower()
    if "m3" in u or "m³" in u:
        return "m3"
    if "gal" in u:
        return "gallon_us"
    if "bbl" in u:
        return "bbl"
    return "l"


def _map_distance_unit(unit: str | None) -> str:
    if not unit:
        return "km"
    u = unit.lower()
    if "mi" in u:
        return "mi"
    if u == "m":
        return "m"
    return "km"


@dataclass
class BuildParamsInput:
    unit_type: str | None
    quantity: float | None
    unit: str | None
    amount: float | None
    currency: str | None


def build_parameters(
    inp: BuildParamsInput,
    factor_unit_types: list[str] | None = None,
) -> dict[str, Any]:
    """
    Build Climatiq estimate parameters from activity data.
    unit_type → (param_key, unit_key) per spec: Weight, Energy, Volume, Money, etc.
    """
    unit_types = [u.lower() for u in (factor_unit_types or [])]
    ut = (inp.unit_type or "").strip() or None

    if ut == "Money" and inp.amount is not None:
        return {"money": inp.amount, "money_unit": (inp.currency or "usd").lower()}
    if ut == "Energy" and inp.quantity is not None:
        return {"energy": inp.quantity, "energy_unit": _map_energy_unit(inp.unit)}
    if ut == "Weight" and inp.quantity is not None:
        return {"weight": inp.quantity, "weight_unit": _map_weight_unit(inp.unit)}
    if ut == "Volume" and inp.quantity is not None:
        return {"volume": inp.quantity, "volume_unit": _map_volume_unit(inp.unit)}
    if ut == "Distance" and inp.quantity is not None:
        return {"distance": inp.quantity, "distance_unit": _map_distance_unit(inp.unit)}
    if ut == "Number" and inp.quantity is not None:
        return {"number": inp.quantity}
    if ut == "Power" and inp.quantity is not None:
        # Power: convert to energy (e.g. MW * 8760 -> MWh/year)
        energy = inp.quantity * 8760
        energy_unit = "MWh" if inp.unit and "mw" in (inp.unit or "").lower() else "kWh"
        return {"energy": energy, "energy_unit": energy_unit}
    if ut == "Area" and inp.quantity is not None:
        return {"area": inp.quantity, "area_unit": (inp.unit or "m2").lower()}
    if ut == "Data" and inp.quantity is not None:
        return {"data": inp.quantity, "data_unit": (inp.unit or "GB").lower()}
    if ut == "Time" and inp.quantity is not None:
        return {"time": inp.quantity, "time_unit": (inp.unit or "hour").lower()}

    # Fallback: match factor unit types or use quantity/amount
    if inp.quantity is not None:
        if unit_types and "weight" in unit_types:
            return {"weight": inp.quantity, "weight_unit": _map_weight_unit(inp.unit)}
        if unit_types and "energy" in unit_types:
            return {"energy": inp.quantity, "energy_unit": _map_energy_unit(inp.unit)}
        if unit_types and "money" in unit_types:
            return {"money": inp.quantity, "money_unit": (inp.currency or "usd").lower()}
        if unit_types and "volume" in unit_types:
            return {"volume": inp.quantity, "volume_unit": _map_volume_unit(inp.unit)}
        if unit_types and "number" in unit_types:
            return {"number": inp.quantity}
        return {"weight": inp.quantity, "weight_unit": _map_weight_unit(inp.unit)}

    if inp.amount is not None:
        return {"money": inp.amount, "money_unit": (inp.currency or "usd").lower()}

    if unit_types and "money" in unit_types:
        return {"money": 1000, "money_unit": "usd"}
    return {"weight": 1, "weight_unit": "kg"}


# ─── Search ──────────────────────────────────────────────────────────────

@dataclass
class SearchResult:
    results: list[dict[str, Any]]
    fallback_used: str  # "none" | "no_region" | "no_region_no_unit" | "all_failed"


def search_factors(
    query: str,
    region: str | None = None,
    unit_type: str | None = None,
    year: int | None = None,
    category: str | None = None,
    results_per_page: int = 5,
) -> SearchResult:
    """
    GET /search with optional region/unit_type/year/category.
    Region/unit_type fallback: if empty with region, retry without region;
    if still empty with unit_type, retry without unit_type.
    Stub (no API key): return one dict from keyword rules.
    """
    if _is_stub():
        return SearchResult(results=[_stub_search_result(query)], fallback_used="stub")

    climatiq_region = map_region_to_climatiq(region) if region else None
    if climatiq_region == "GLOBAL":
        climatiq_region = None

    # Attempt 1: with region + unit_type
    results = _call_search(query, climatiq_region, unit_type, year, category, results_per_page)
    if results:
        return SearchResult(results=results, fallback_used="none")

    # Attempt 2: without region
    if climatiq_region:
        results = _call_search(query, None, unit_type, year, category, results_per_page)
        if results:
            logger.info("Search fallback: no_region for query=%s", query[:50])
            return SearchResult(results=results, fallback_used="no_region")

    # Attempt 3: without unit_type
    if unit_type:
        results = _call_search(query, None, None, year, category, results_per_page)
        if results:
            logger.info("Search fallback: no_region_no_unit for query=%s", query[:50])
            return SearchResult(results=results, fallback_used="no_region_no_unit")

    return SearchResult(results=[], fallback_used="all_failed")


def _call_search(
    query: str,
    region: str | None,
    unit_type: str | None,
    year: int | None,
    category: str | None,
    results_per_page: int,
) -> list[dict[str, Any]]:
    params = {
        "query": query,
        "data_version": DATA_VERSION,
        "results_per_page": str(results_per_page),
    }
    if region:
        params["region"] = region
    if unit_type:
        params["unit_type"] = unit_type
    if year is not None:
        params["year"] = str(year)
    if category:
        params["category"] = category

    qs = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
    url = f"{BASE_URL}/search?{qs}"
    key = _get_api_key()
    status, data, err = _request_with_retry(url, headers={"Authorization": f"Bearer {key}"})
    if status != 200 or data is None:
        logger.warning("Search failed: status=%s err=%s", status, err)
        return []
    return data.get("results") or []


def _stub_search_result(query: str) -> dict[str, Any]:
    q = (query or "").lower()
    activity_id = "consumer_goods-type_general"
    name = "General consumer goods"
    if "cement" in q or "concrete" in q:
        activity_id, name = "building_materials-type_cement", "Cement production"
    elif "steel" in q:
        activity_id, name = "metals-type_basic_iron_and_steel", "Steel production"
    elif "electricity" in q or "grid" in q:
        activity_id, name = "electricity-supply_grid-source_residual_mix", "Electricity grid supply"
    elif "diesel" in q:
        activity_id, name = "fuel_type_diesel-fuel_use_stationary", "Diesel fuel combustion"
    elif "natural gas" in q or ("gas" in q and "natural" in q):
        activity_id, name = "fuel_type_natural_gas-fuel_use_stationary", "Natural gas combustion"
    return {
        "activity_id": activity_id,
        "name": name,
        "source": "Stub (no API key)",
        "year": 2023,
        "unit_type": ["weight"],
        "region": None,
    }


# ─── Estimate single ────────────────────────────────────────────────────

@dataclass
class EstimateResult:
    co2e: float
    co2e_unit: str
    emission_factor: dict[str, Any]
    error: str | None = None


def estimate_single(
    activity_id: str,
    parameters: dict[str, Any],
    region: str | None = None,
) -> EstimateResult:
    """
    POST /estimate. Region fallback: on 4xx not found, retry without region.
    Stub: deterministic co2e by unit_type (Weight 0.9, Energy 0.4, etc.) * quantity.
    """
    if _is_stub():
        return _stub_estimate_single(parameters)

    climatiq_region = map_region_to_climatiq(region) if region else None
    if climatiq_region == "GLOBAL":
        climatiq_region = None

    body: dict[str, Any] = {
        "emission_factor": {"activity_id": activity_id, "data_version": DATA_VERSION},
        "parameters": parameters,
    }
    if climatiq_region:
        body["emission_factor"]["region"] = climatiq_region

    url = f"{BASE_URL}/estimate"
    key = _get_api_key()
    status, data, err = _request_with_retry(url, method="POST", body=body, headers={"Authorization": f"Bearer {key}"})

    if status == 200 and data:
        return EstimateResult(
            co2e=float(data.get("co2e", 0)),
            co2e_unit=str(data.get("co2e_unit", "kg_co2e")),
            emission_factor=data.get("emission_factor") or {},
            error=None,
        )

    # Region fallback on 4xx
    if status and 400 <= status < 500 and climatiq_region and ("not found" in (err or "").lower() or "no emission" in (err or "").lower()):
        body["emission_factor"].pop("region", None)
        status2, data2, err2 = _request_with_retry(url, method="POST", body=body, headers={"Authorization": f"Bearer {key}"})
        if status2 == 200 and data2:
            return EstimateResult(
                co2e=float(data2.get("co2e", 0)),
                co2e_unit=str(data2.get("co2e_unit", "kg_co2e")),
                emission_factor=data2.get("emission_factor") or {},
                error=None,
            )

    return EstimateResult(
        co2e=0.0,
        co2e_unit="kg_co2e",
        emission_factor={},
        error=err or f"HTTP {status}",
    )


def _stub_estimate_single(parameters: dict[str, Any]) -> EstimateResult:
    quantity = (
        parameters.get("weight")
        or parameters.get("energy")
        or parameters.get("volume")
        or parameters.get("money")
        or parameters.get("number")
        or parameters.get("distance")
        or parameters.get("area")
        or parameters.get("data")
        or 1
    )
    if quantity is None:
        quantity = 1
    factors: dict[str, float] = {
        "weight": 0.9,
        "energy": 0.4,
        "volume": 2.7,
        "money": 0.5,
        "power": 0.4 * 8760,
        "distance": 0.12,
        "number": 50.0,
        "area": 15.0,
    }
    param_key = next((k for k in factors if k in parameters), "weight")
    factor = factors.get(param_key, 1.0)
    co2e = float(quantity) * factor
    return EstimateResult(
        co2e=round(co2e, 2),
        co2e_unit="kg_co2e",
        emission_factor={"activity_id": "stub", "source": "Stub (no API key)", "year": 2023},
        error=None,
    )


# ─── Estimate batch ─────────────────────────────────────────────────────

def estimate_batch(items: list[dict[str, Any]]) -> list[EstimateResult]:
    """
    POST /estimate/batch. Chunk by 100; concatenate responses.
    Per-item errors: if element is error object, treat as failed for that index.
    Stub: loop and call stub logic per item.
    """
    if _is_stub():
        return [_stub_estimate_single(item.get("parameters", {})) for item in items]

    key = _get_api_key()
    all_results: list[EstimateResult] = []
    for i in range(0, len(items), 100):
        chunk = items[i : i + 100]
        url = f"{BASE_URL}/estimate/batch"
        body = chunk
        status, data, err = _request_with_retry(url, method="POST", body=body, headers={"Authorization": f"Bearer {key}"})

        if status != 200 or data is None:
            for _ in chunk:
                all_results.append(EstimateResult(0.0, "kg_co2e", {}, error=err or f"HTTP {status}"))
            continue

        results_list = data if isinstance(data, list) else data.get("results", data.get("data", []))
        for elem in results_list:
            if isinstance(elem, dict) and "error" in elem:
                all_results.append(EstimateResult(0.0, "kg_co2e", {}, error=str(elem.get("error", elem))))
            elif isinstance(elem, dict):
                all_results.append(EstimateResult(
                    co2e=float(elem.get("co2e", 0)),
                    co2e_unit=str(elem.get("co2e_unit", "kg_co2e")),
                    emission_factor=elem.get("emission_factor") or {},
                    error=None,
                ))
            else:
                all_results.append(EstimateResult(0.0, "kg_co2e", {}, error="Invalid response"))

    return all_results
