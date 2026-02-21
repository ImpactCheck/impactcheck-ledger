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

GEMINI_MODEL = "gemini-3-flash-preview"
GEMINI_ESTIMATION_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

_ESTIMATION_PROMPT = """\
You are a carbon footprint expert. Estimate the CO2e emissions in kilograms \
(kg CO2 equivalent) for the activity described below.

Activity: {activity_text}
Quantity: {quantity_str}
{factor_line}

Guidelines:
- Use IPCC / GHG Protocol / Ecoinvent global average emission intensities
- For materials: include manufacturing + upstream transport emissions
- For energy: use global average grid intensity (~0.45 kgCO2e/kWh) unless region stated
- For servers/hardware: use lifecycle embedded carbon (approx 1,000-3,000 kgCO2e per server)
- For transport: use typical freight emission factors (road ~0.1, sea ~0.01, air ~0.6 kgCO2e/t-km)
- Be conservative: prefer slightly lower estimates over speculation
- If quantity is unknown, assume a representative single unit or typical annual amount

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

    prompt = _ESTIMATION_PROMPT.format(
        activity_text=activity_text,
        quantity_str=quantity_str,
        factor_line=factor_line,
    )

    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
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
        return None

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
        return None
    except Exception as exc:
        logger.warning("Gemini estimation parse failed for '%s': %s", activity_text[:60], exc)
        return None
