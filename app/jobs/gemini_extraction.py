"""Gemini-based activity extraction from uploaded documents.

Supports PDF (sent as base64 inline data), Excel (converted to text),
and plain text / CSV files.
"""
from __future__ import annotations

import base64
import json
import re
from pathlib import Path

import httpx

from app.models import Document, ExtractedActivity, Project

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)

VALID_UNIT_TYPES = {
    "Area", "AreaOverTime", "ContainerOverDistance", "Data", "DataOverTime",
    "Distance", "DistanceOverTime", "Energy", "Power", "Money", "Number",
    "NumberOverTime", "PassengerOverDistance", "Time", "Volume", "Weight",
    "WeightOverDistance", "WeightOverTime",
}

BRAND_MAP: dict[str, str] = {
    "nvidia": "computer servers",
    "gb200": "computer servers",
    "nvl72": "computer servers",
    "h100": "gpu servers",
    "a100": "gpu servers",
    "vertiv": "cooling equipment",
    "liebert": "cooling equipment",
    "caterpillar": "diesel generator",
    "cummins": "diesel generator",
    "tesla": "battery lithium ion",
    "megapack": "battery lithium ion",
    "powerpack": "battery lithium ion",
    "abb": "electrical switchgear",
    "schneider": "electrical equipment",
    "knauf": "insulation glass wool",
    "earthwool": "insulation glass wool",
    "kingspan": "insulation board",
}

EXTRACTION_PROMPT = """\
You are a carbon emissions data extraction specialist. Extract all emission-producing \
activities from the documents provided and prepare them for the Climatiq emissions \
database Search API.

CRITICAL RULES FOR search_query:
The Climatiq Search API uses fuzzy text matching against emission factor names. \
Long verbose strings perform POORLY. Each search_query MUST be 2-5 generic \
material/activity keywords.

TRANSFORMATION RULES:
- Brand names → generic material: "NVIDIA GB200" → "computer servers", \
"Vertiv Liebert XDU" → "cooling equipment", "Caterpillar C175" → "diesel generator", \
"Tesla Megapack" → "battery lithium ion"
- Specific grades → generic: "Portland cement CEM I 42.5N" → "cement", \
"C30/37 structural mix" → "concrete", "Grade 60 rebar" → "steel rebar", \
"6061-T6 aluminum" → "aluminum sheet"
- Energy → Climatiq style: "Electricity from grid" → "electricity supply grid", \
"Gas boiler" → "natural gas combustion", "Backup diesel gensets" → "diesel fuel combustion"
- Transport → Climatiq style: "Container shipping" → "freight sea shipping", \
"Trucking" → "freight road truck", "Air cargo" → "freight air transport"
- Strip jargon, project codes, phase numbers, adjectives like "sustainable" or "low-carbon"

UNIT TYPE - must be EXACTLY one of these Climatiq values (case-sensitive) or null:
Weight, Energy, Power, Volume, Area, Distance, Money, Number, Data, Time, \
WeightOverDistance, ContainerOverDistance, PassengerOverDistance, AreaOverTime, \
DataOverTime, DistanceOverTime, NumberOverTime, WeightOverTime

UNIT TYPE INFERENCE:
- kg, t, ton, lb, g → "Weight"
- kWh, MWh, GWh, MJ, GJ, TJ → "Energy"
- W, kW, MW → "Power"
- l, L, m3, gallon → "Volume"
- m2, km2, ft2 → "Area"
- km, mi → "Distance"
- $, €, £, USD, EUR, GBP → "Money"
- MB, GB, TB → "Data"
- units, pieces, count → "Number"

CATEGORY - one of: HARDWARE, CONSTRUCTION, ENERGY, TRANSPORT, OPERATIONS, \
PROCUREMENT, WASTE, WATER, OTHER

IMPORTANT: If a line item has BOTH a physical quantity AND a monetary value, \
create TWO separate rows:
- Row 1: unit_type = physical type, quantity = physical amount, unit = physical unit
- Row 2: unit_type = "Money", quantity = spend amount, unit = currency code (e.g. "usd")

Return a JSON array. Each object must have:
- search_query: (required) 2-5 word keyword string for Climatiq Search API. \
NO brand names, NO long descriptions.
- raw_text: (required) Original text as extracted from document
- unit_type: One valid Climatiq unit type or null
- quantity: Numeric value if found, or null
- unit: Unit string (e.g. "t", "kg", "kWh", "usd") or null
- amount: Monetary amount if applicable, or null
- currency: Currency code if applicable (e.g. "usd", "eur") or null
- region: Region code if mentioned or null
- category: One of the categories above
- confidence: "HIGH", "MEDIUM", or "LOW"
- source_doc_index: 0-based index of the source document
- source_page: Page/row reference string or null
- note: Any additional context or null

Return ONLY a valid JSON array, no markdown fences, no explanation."""


def _validate_unit_type(ut: str | None) -> str | None:
    if not ut:
        return None
    if ut in VALID_UNIT_TYPES:
        return ut
    for valid in VALID_UNIT_TYPES:
        if valid.lower() == ut.lower():
            return valid
    return None


def _normalize_search_query(query: str) -> str:
    if not query:
        return "unknown activity"
    q = query.lower().strip()
    q = re.sub(r"\b(phase|stage|q[1-4]|fy\d+|20\d{2})\s*\d*", "", q, flags=re.IGNORECASE)
    q = re.sub(
        r"\b(sustainable|low-carbon|eco-friendly|green|high-performance|premium|advanced)\b",
        "",
        q,
        flags=re.IGNORECASE,
    )
    q = re.sub(
        r"\b(procurement|supply|provision|installation|of|the|and|for|from|with)\b",
        " ",
        q,
        flags=re.IGNORECASE,
    )
    words = q.split()
    for word in words:
        if word in BRAND_MAP:
            return BRAND_MAP[word]
    cleaned = " ".join(words[:5])
    return cleaned or "unknown activity"


def _excel_to_text(path: Path) -> str:
    """Convert an Excel workbook to a plain-text table for Gemini."""
    import openpyxl

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sections: list[str] = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        sections.append(f"Sheet: {sheet_name}")
        for row in rows:
            sections.append("\t".join("" if c is None else str(c) for c in row))
    wb.close()
    return "\n".join(sections)


def _build_parts(
    docs: list[Document],
    stored_paths: list[Path | None],
) -> list[dict]:
    """Build the Gemini API `parts` list from the uploaded documents."""
    parts: list[dict] = []

    for idx, (doc, path) in enumerate(zip(docs, stored_paths)):
        label = f"[Document {idx}: {doc.filename}]"

        if path is None or not path.exists():
            parts.append({"text": f"{label}\n[File not found on disk]"})
            continue

        ext = path.suffix.lower()

        if ext == ".pdf":
            raw_bytes = path.read_bytes()
            parts.append({
                "inlineData": {
                    "mimeType": "application/pdf",
                    "data": base64.b64encode(raw_bytes).decode("utf-8"),
                }
            })
            # Label comes after so Gemini sees the index
            parts.append({"text": label})

        elif ext in (".xlsx", ".xls"):
            try:
                text_repr = _excel_to_text(path)
            except Exception as exc:
                text_repr = f"[Excel parse error: {exc}]"
            parts.append({"text": f"{label}\n{text_repr[:30000]}"})

        else:
            # Plain text, CSV, TSV, etc.
            try:
                content = path.read_text(encoding="utf-8", errors="replace")
            except Exception as exc:
                content = f"[Read error: {exc}]"
            parts.append({"text": f"{label}\n{content[:20000]}"})

    return parts


async def extract_with_gemini(
    api_key: str,
    project: Project,
    docs: list[Document],
    stored_paths: list[Path | None],
) -> list[ExtractedActivity]:
    """Call Gemini to extract activities from the provided documents.

    Falls back to an empty list if Gemini returns an unusable response.
    """
    document_parts = _build_parts(docs, stored_paths)
    if not document_parts:
        return []

    # Instruction comes last so Gemini reads the documents first
    all_parts = document_parts + [{"text": EXTRACTION_PROMPT}]

    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(
            GEMINI_URL,
            params={"key": api_key},
            json={
                "contents": [{"parts": all_parts}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 8192},
            },
        )
        resp.raise_for_status()
        data = resp.json()

    raw_text: str = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "[]")
    raw_text = re.sub(r"```json\s*", "", raw_text)
    raw_text = re.sub(r"```\s*", "", raw_text).strip()

    try:
        extracted: list[dict] = json.loads(raw_text)
        if not isinstance(extracted, list):
            extracted = []
    except Exception:
        extracted = []

    activities: list[ExtractedActivity] = []
    for idx, item in enumerate(extracted):
        src_idx = item.get("source_doc_index") or 0
        src_doc = docs[src_idx] if isinstance(src_idx, int) and src_idx < len(docs) else None

        raw = item.get("raw_text") or ""
        sq = _normalize_search_query(item.get("search_query") or raw)

        activities.append(
            ExtractedActivity(
                id=f"act_{idx + 1:04d}",
                projectId=project.id,
                text=sq or "Unknown activity",
                search_query=sq or None,
                unit_type=_validate_unit_type(item.get("unit_type")),
                region=item.get("region") or project.primaryRegion,
                quantity=_to_float(item.get("quantity")),
                unit=item.get("unit") or None,
                amount=_to_float(item.get("amount")),
                currency=item.get("currency") or None,
                sourceDocumentId=src_doc.id if src_doc else None,
                note=(raw[:200] if raw else item.get("note") or None),
            )
        )

    return activities


def _to_float(val: object) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None
