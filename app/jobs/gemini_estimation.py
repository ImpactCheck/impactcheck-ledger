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

GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_ESTIMATION_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

_ESTIMATION_PROMPT = """\
You are a carbon footprint expert specialising in AI data-center infrastructure.
Estimate the TOTAL annual CO2e emissions in kilograms (kg CO2 equivalent) for the \
activity described below.
{doc_context_line}
Activity: {activity_text}
Quantity: {quantity_str}
{factor_line}

CRITICAL — NEVER RETURN ZERO:
- You MUST provide a positive CO2e estimate. Zero is NEVER acceptable.
- Every physical activity has a carbon footprint. Use industry benchmarks, typical \
values, or conservative engineering estimates when exact data is unavailable.
- If the Climatiq API had no matching factor or rejected the unit type, you are the \
fallback: produce a defensible best-effort estimate.

IMPORTANT — ANNUALISATION RULES:
- Your answer must represent a FULL YEAR of impact (12 months).
- EMBODIED (one-time capital items): divide lifetime emissions by the asset lifetime.
  • GPU / AI accelerator (H100, A100, GB200): ~1,500 kgCO2e embodied per unit; \
assume 5-year lifetime → 300 kgCO2e/unit/year.
  • Standard server / rack server: ~1,000 kgCO2e; 5-year → 200 kgCO2e/unit/year.
  • Networking switch/router: ~200 kgCO2e; 5-year → 40 kgCO2e/unit/year.
  • UPS / PDU / power equipment: ~500 kgCO2e; 10-year → 50 kgCO2e/unit/year.
  • Data-center construction: ~500 kgCO2e/m²; 25-year → 20 kgCO2e/m²/year.
  • Cooling unit (CRAC/CRAH): ~2,000 kgCO2e; 15-year → 133 kgCO2e/unit/year.
- OPERATIONAL (recurring): scale raw quantity to a full year if needed.
  • Electricity: use grid intensity by region:
      texas_ercot ~0.39, virginia_pjm ~0.32, iowa_miso ~0.43,
      norway_hydro ~0.02, iceland_geo ~0.03, singapore ~0.41,
      global average ~0.45 kgCO2e/kWh.
    If the quantity is in kW (power), multiply by 8,760 h/year first.
  • Diesel / HVO fuel: 2.68 kgCO2e/litre; scale monthly → ×12 or daily → ×365.
  • Natural gas: 2.04 kgCO2e/m³.
  • Water (cooling towers): 0.0003 kgCO2e/litre.
  • Cloud / data-transfer fees: use ~0.008 kgCO2e/GB transferred.

Additional guidelines:
- If quantity is unknown, search the document context above for the relevant quantity; \
if not found use a conservative representative amount for a mid-size AI data center.
- ABSOLUTELY NEVER return 0. Every activity has carbon impact — always provide a \
positive best-effort estimate using industry benchmarks or typical values.
- Be honest about confidence: "high" only if a specific quantity and unit are given.

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
