"""
ImpactCheck — Climatiq Search + Estimate API Test (Free Tier)
Pipeline: Search (find activity_id) → Estimate (calculate CO2e)

Usage:
  export CLIMATIQ_API_KEY="your-key-here"
  python climatiq_api_test.py
"""

import os, csv, json, io, time
import urllib.request
import urllib.parse

API_KEY = os.environ.get("CLIMATIQ_API_KEY", "YOUR_API_KEY_HERE")
BASE = "https://api.climatiq.io/data/v1"
DATA_VERSION = "^21"

# ── Sample CSV (matching the updated prompt format) ─────────────
SAMPLE_CSV = """\
search_query,unit_type,region,quantity,unit,category
cement,Weight,US,10000,t,CONSTRUCTION
steel rebar,Weight,US,3000,t,CONSTRUCTION
electricity supply grid,Energy,US,500000,MWh,ENERGY
diesel fuel combustion,Volume,US,100000,l,ENERGY
concrete,Weight,US,5000,t,CONSTRUCTION
natural gas,Energy,US,15000,MWh,ENERGY
water supply,Volume,US,200000,m3,OPERATIONS
aluminum sheet,Weight,US,600,t,CONSTRUCTION
"""

# ── Unit type → estimate parameter key mapping ──────────────────
PARAM_MAP = {
    "Weight":  ("weight", "weight_unit"),
    "Money":   ("money", "money_unit"),
    "Energy":  ("energy", "energy_unit"),
    "Volume":  ("volume", "volume_unit"),
    "Power":   ("power", "power_unit"),
    "Distance": ("distance", "distance_unit"),
    "Number":  ("number", None),
}


def search(query: str, unit_type: str, region: str | None = None) -> dict | None:
    """Search for emission factors. Returns the top result or None."""
    params = {
        "query": query,
        "unit_type": unit_type,
        "data_version": DATA_VERSION,
        "results_per_page": "3",
    }
    if region:
        params["region"] = region

    url = f"{BASE}/search?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {API_KEY}"})

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())

        results = data.get("results", [])
        if not results and region:
            # Fallback: retry without region filter
            print(f"    ↻ No results for region={region}, retrying globally...")
            return search(query, unit_type, region=None)

        return results[0] if results else None

    except urllib.error.HTTPError as e:
        print(f"  ✗ Search HTTP {e.code}: {e.read().decode()}")
        return None


def estimate(activity_id: str, region: str, quantity: float, unit: str, unit_type: str) -> dict | None:
    """Call the Estimate endpoint with an activity_id."""
    param_key, unit_key = PARAM_MAP.get(unit_type, (None, None))
    if not param_key:
        print(f"  ⚠ Unknown unit_type '{unit_type}', skipping")
        return None

    params = {param_key: quantity}
    if unit_key:
        params[unit_key] = unit

    payload = {
        "emission_factor": {
            "activity_id": activity_id,
            "data_version": DATA_VERSION,
        },
        "parameters": params,
    }

    # Add region to selector if available
    if region:
        payload["emission_factor"]["region"] = region

    data_bytes = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE}/estimate",
        data=data_bytes,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        # If region-specific factor not found, retry without region
        if region and ("not found" in body.lower() or "no emission" in body.lower()):
            print(f"    ↻ No factor for region={region}, retrying without region...")
            payload["emission_factor"].pop("region", None)
            data_bytes = json.dumps(payload).encode()
            req2 = urllib.request.Request(
                f"{BASE}/estimate",
                data=data_bytes,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
            )
            try:
                with urllib.request.urlopen(req2) as resp2:
                    return json.loads(resp2.read())
            except urllib.error.HTTPError as e2:
                print(f"  ✗ Estimate HTTP {e2.code}: {e2.read().decode()}")
                return None
        print(f"  ✗ Estimate HTTP {e.code}: {body}")
        return None


def main():
    print("=" * 60)
    print("ImpactCheck — Search + Estimate Test (Free Tier)")
    print("=" * 60)

    if API_KEY == "YOUR_API_KEY_HERE":
        print("\n⚠  Set your API key:  export CLIMATIQ_API_KEY=...\n")
        return

    reader = csv.DictReader(io.StringIO(SAMPLE_CSV))
    results = []

    for i, row in enumerate(reader, 1):
        query = row["search_query"]
        unit_type = row["unit_type"]
        region = row.get("region", "")
        print(f"\n[{i}] Query: \"{query}\"  |  Unit: {unit_type}  |  Region: {region}")

        # ── Step 1: Search ──
        factor = search(query, unit_type, region or None)
        if not factor:
            print("  ✗ No emission factors found")
            continue

        aid = factor["activity_id"]
        name = factor["name"]
        source = factor["source"]
        f_region = factor["region"]
        f_unit = factor["unit"]
        print(f"  → Found: {name}")
        print(f"    activity_id: {aid}")
        print(f"    Source: {source}  |  Region: {f_region}  |  Unit: {f_unit}")

        # ── Step 2: Estimate ──
        qty = float(row["quantity"]) if row.get("quantity") else None
        unit = row.get("unit", "")

        if qty and unit:
            est = estimate(aid, region or None, qty, unit, unit_type)
            if est and "co2e" in est:
                co2e = est["co2e"]
                co2e_unit = est["co2e_unit"]
                print(f"  ✓ CO2e: {co2e:,.2f} {co2e_unit}")

                # Show matched factor details if audit trail enabled
                ef = est.get("emission_factor")
                if ef:
                    print(f"    Matched: {ef.get('name', 'N/A')} ({ef.get('source', 'N/A')}, {ef.get('region', 'N/A')})")

                results.append({
                    "query": query,
                    "activity_id": aid,
                    "co2e": co2e,
                    "co2e_unit": co2e_unit,
                    "matched_name": name,
                    "source": source,
                    "region": f_region,
                })
            else:
                print("  ✗ Estimate failed")
        else:
            print("  ⚠ No quantity, skipping estimate")

        time.sleep(0.3)

    # ── Summary ──
    if results:
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        total = sum(r["co2e"] for r in results)
        for r in sorted(results, key=lambda x: x["co2e"], reverse=True):
            pct = (r["co2e"] / total) * 100 if total else 0
            print(f"  {r['co2e']:>14,.2f} kg  ({pct:5.1f}%)  {r['query']}")
            print(f"  {'':>14s}        → {r['activity_id']}")
        print(f"\n  {'TOTAL':>14s}:  {total:,.2f} kg CO2e  ({total/1000:,.1f} tonnes)")
    else:
        print("\n⚠ No successful estimates. Check your API key and network.")


if __name__ == "__main__":
    main()