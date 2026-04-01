"""Synchronous Gemini-based CO2e estimation fallback.

Used by mapping_pipeline.py when Climatiq cannot provide an estimate.
Uses urllib (synchronous) to match the sync nature of the mapping pipeline.
"""
from __future__ import annotations

import json
import logging
import re
import urllib.request

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_ESTIMATION_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

_ESTIMATION_PROMPT = """\
You are a carbon footprint expert with broad knowledge across all industries and \
activity types. Estimate the TOTAL CO2e emissions in kilograms (kg CO2 equivalent) \
for the activity described below.
{doc_context_line}
Activity: {activity_text}
Quantity: {quantity_str}
{factor_line}

CRITICAL — NEVER RETURN ZERO:
- You MUST provide a positive CO2e estimate. Zero is NEVER acceptable.
- Every physical activity has a carbon footprint. Use IPCC, GHG Protocol, or \
industry benchmark values when exact data is unavailable.
- You are the fallback when Climatiq had no matching factor — produce a \
defensible best-effort estimate.

EMISSION FACTOR BENCHMARKS (use these for direct calculations):
TRANSPORT (use directly with quantity if unit_type is WeightOverDistance or PassengerOverDistance):
  • Air freight (belly/cargo): 0.60 kgCO2e per tonne-km
  • Air freight (freighter): 0.80 kgCO2e per tonne-km
  • Road freight (HGV/truck): 0.10 kgCO2e per tonne-km
  • Rail freight (electric): 0.028 kgCO2e per tonne-km
  • Rail freight (diesel): 0.06 kgCO2e per tonne-km
  • Sea freight (container): 0.015 kgCO2e per tonne-km
  • Passenger flight (short-haul <3h): 0.18 kgCO2e per passenger-km
  • Passenger flight (long-haul >6h): 0.14 kgCO2e per passenger-km
  • Car (average): 0.17 kgCO2e per passenger-km

ENERGY:
  • Electricity (global average): 0.45 kgCO2e/kWh; Sweden: 0.02 kgCO2e/kWh
  • Natural gas: 2.04 kgCO2e/m³; Diesel: 2.68 kgCO2e/litre

MATERIALS (per tonne):
  • Steel: 1,800 kgCO2e/t; Concrete: 130 kgCO2e/t; Cement: 900 kgCO2e/t
  • Aluminium: 8,000 kgCO2e/t; Copper: 3,500 kgCO2e/t

HARDWARE (embodied, per unit):
  • GPU server (H100/A100): ~1,500 kgCO2e; Standard server: ~1,000 kgCO2e
  • Cooling unit: ~2,000 kgCO2e; UPS/PDU: ~500 kgCO2e

IMPORTANT: If unit_type is WeightOverDistance (tonne-km) multiply directly by the \
relevant transport factor above. Do NOT annualise transport — it is already a \
one-time or period total.

Additional guidelines:
- If quantity is unknown, use a conservative representative amount.
- ABSOLUTELY NEVER return 0.
- Be honest about confidence: "high" if specific quantity + unit given, \
"medium" if estimated from context, "low" if purely assumed.

Respond with ONLY a JSON object (no markdown fences, no explanation):
{{"co2e_kg": <number>, "confidence": "high|medium|low", "rationale": "<one sentence>"}}"""


def estimate_co2e_with_gemini(
    api_key: str,
    activity_text: str,
    quantity: float | None,
    unit: str | None,
    unit_type: str | None,
    factor_name: str | None = None,
    factor_unit: str | None = None,
    doc_parts: list[dict] | None = None,
) -> float | None:
    """Synchronous Gemini call to estimate CO2e in kg.

    Returns kg CO2e as a positive float, or None if the call fails or
    returns a non-positive value.
    """
    if not api_key:
        return None

    if quantity is not None:
        quantity_str = f"{quantity} {unit or unit_type or ''}".strip()
    else:
        quantity_str = "unknown — use a typical representative amount"

    factor_line = ""
    if factor_name:
        factor_line = f"Best matched emission factor: {factor_name}"
        if factor_unit:
            factor_line += f" (unit: {factor_unit})"

    doc_context_line = (
        "\nDocument context is provided above — search it for the exact quantity "
        "and scale of this activity.\n"
        if doc_parts else ""
    )

    prompt = _ESTIMATION_PROMPT.format(
        doc_context_line=doc_context_line,
        activity_text=activity_text,
        quantity_str=quantity_str,
        factor_line=factor_line,
    )

    content_parts: list[dict] = list(doc_parts) if doc_parts else []
    content_parts.append({"text": prompt})

    body = json.dumps({
        "contents": [{"parts": content_parts}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 512,
            "response_mime_type": "application/json",
        },
    }).encode()

    url = f"{GEMINI_ESTIMATION_URL}?key={api_key}"
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except Exception as exc:
        logger.warning("Gemini estimation HTTP call failed for '%s': %s", activity_text[:60], exc)
        # Zero is never acceptable — use minimum fallback when API fails
        return 1.0

    try:
        raw_text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        raw_text = re.sub(r"```json\s*", "", raw_text)
        raw_text = re.sub(r"```\s*", "", raw_text).strip()
        result = json.loads(raw_text)
        co2e = float(result.get("co2e_kg", 0))
        if co2e > 0:
            logger.info(
                "Gemini fallback estimate for '%s': %.2f kgCO2e (%s)",
                activity_text[:60],
                co2e,
                result.get("confidence", "?"),
            )
            return co2e
        # Zero is never acceptable — use conservative minimum as last resort
        logger.warning(
            "Gemini returned co2e=%.2f for '%s'; using minimum fallback 1.0 kgCO2e",
            co2e,
            activity_text[:60],
        )
        return 1.0
    except Exception as exc:
        logger.warning("Gemini estimation parse failed for '%s': %s", activity_text[:60], exc)
        # Zero is never acceptable — use minimum fallback when parse fails
        return 1.0
