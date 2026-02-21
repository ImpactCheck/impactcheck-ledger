Phase 2: Implement real document extraction for /extract job.

══════════════════════════════════════════════════════════════
OVERVIEW
══════════════════════════════════════════════════════════════

Extract carbon-emitting activities from uploaded documents (PDF, Excel).
Each extracted activity must be shaped for the Climatiq Search → Estimate
free-tier pipeline (no Autopilot access).

The critical output field is `search_query` — a SHORT keyword string (2-5 words)
optimized for Climatiq's fuzzy-match Search API, NOT a verbose description.

══════════════════════════════════════════════════════════════
PDF EXTRACTION
══════════════════════════════════════════════════════════════

Use pypdf to extract text; keep per-page references for source traceability.

Heuristics for activity candidates — flag lines that contain:
  - Bullet/numbered list items
  - Invoice-like patterns: numbers adjacent to units or currency symbols
  - Material keywords: concrete, cement, steel, rebar, aluminum, copper, glass,
    insulation, timber, aggregate, asphalt, brick, plasterboard
  - Hardware keywords: GPU, server, rack, switch, UPS, battery, transformer,
    cooling, CRAC, CRAH, PDU, generator, switchgear
  - Energy keywords: kWh, MWh, GWh, MW, electricity, grid, solar, wind, gas,
    diesel, fuel, power
  - Transport keywords: freight, shipping, logistics, truck, ocean, air cargo,
    TEU, container
  - Construction keywords: excavation, foundation, formwork, cladding, roofing,
    HVAC, piping, ductwork
  - Spend patterns: "$", "€", "£", "USD", "EUR", "GBP", "million", "M", "k",
    followed by or preceded by a number

══════════════════════════════════════════════════════════════
EXCEL EXTRACTION
══════════════════════════════════════════════════════════════

Use pandas read_excel (openpyxl engine).

Column detection strategy:
  1. Scan header row for text/description columns:
     match names like: "description", "item", "material", "service", "activity",
     "product", "component", "line item", "name", "specification"
  2. Scan for quantity columns:
     match: "qty", "quantity", "amount", "volume", "weight", "count", "units"
  3. Scan for unit columns:
     match: "unit", "uom", "unit of measure"
  4. Scan for monetary columns:
     match: "cost", "price", "total", "value", "spend", "budget", "amount"
     (disambiguate from quantity by checking for currency symbols or "cost" in name)
  5. Scan for region/location columns:
     match: "region", "location", "country", "site", "facility"

For each data row: combine text column(s) into a candidate activity, attach
detected quantity/unit and monetary values.

══════════════════════════════════════════════════════════════
SEARCH QUERY GENERATION
══════════════════════════════════════════════════════════════

CRITICAL: The downstream Climatiq Search API uses fuzzy text matching against
emission factor names/descriptions — NOT NLP. Long verbose strings perform
POORLY. Each extracted activity must produce a `search_query` of 2-5 generic
material/activity keywords.

Apply these transformations to raw extracted text:

1. BRAND → GENERIC MATERIAL:
   "NVIDIA GB200 NVL72"          → "computer servers"
   "Vertiv Liebert XDU"          → "cooling equipment"
   "Caterpillar C175 generator"  → "diesel generator"
   "Tesla Megapack"              → "battery lithium ion"
   "ABB SafeRing"                → "electrical switchgear"
   "Knauf Earthwool"             → "glass wool insulation"

2. SPECIFIC GRADE → GENERIC NAME:
   "Portland cement CEM I 42.5N" → "cement"
   "C30/37 structural mix"       → "concrete"
   "Grade 60 rebar"              → "steel rebar"
   "6061-T6 aluminum alloy"      → "aluminum sheet"
   "Cat6A copper cabling"        → "copper wire cable"
   "R-134a refrigerant"          → "refrigerant r134a"

3. ENERGY ACTIVITIES → Climatiq-style names:
   "Electricity from ERCOT grid" → "electricity supply grid"
   "Gas-fired boiler heating"    → "natural gas"
   "Backup diesel gensets"       → "diesel fuel combustion"
   "Rooftop solar PV"            → "solar photovoltaic"

4. TRANSPORT → Climatiq-style names:
   "Container shipping from Shenzhen" → "freight sea shipping"
   "Trucking from warehouse"          → "freight road truck"
   "Air cargo express"                → "freight air"

5. STRIP jargon, project codes, adjectives:
   "Phase 2 low-carbon sustainable concrete mix" → "concrete"
   "IT procurement Q3 2026"                      → "computer servers"

Implementation: build a keyword normalizer function that applies regex patterns
and a lookup table for common brand→generic mappings. This does NOT need to be
perfect — Climatiq's fuzzy search is forgiving, but shorter queries consistently
outperform verbose ones.

══════════════════════════════════════════════════════════════
UNIT TYPE INFERENCE
══════════════════════════════════════════════════════════════

Infer exactly ONE of these valid Climatiq unit_type values (case-sensitive):

  Area, AreaOverTime, ContainerOverDistance, Data, DataOverTime,
  Distance, DistanceOverTime, Energy, Power, Money, Number,
  NumberOverTime, PassengerOverDistance, Time, Volume, Weight,
  WeightOverDistance, WeightOverTime

Inference rules (apply in order):
  1. Unit detected is kg, t, ton, lb, g         → "Weight"
  2. Unit detected is kWh, MWh, GWh, MJ, GJ, TJ, therm, MMBTU → "Energy"
  3. Unit detected is W, kW, MW                  → "Power"
  4. Unit detected is l, L, m3, gallon, bbl      → "Volume"
  5. Unit detected is m2, km2, ft2, ha           → "Area"
  6. Unit detected is km, mi, m (distance ctx)   → "Distance"
  7. Unit detected is MB, GB, TB                 → "Data"
  8. Unit detected is a currency ($, €, £, USD, EUR, GBP, SEK, etc.) → "Money"
  9. Unit detected is TEU + distance             → "ContainerOverDistance"
  10. Weight + distance detected together        → "WeightOverDistance"
  11. Count-like (units, pieces, rooms, nights)  → "Number"
  12. Cannot determine                           → leave blank (let search return all types)

IMPORTANT: If both a physical quantity AND a monetary value are detected for the
same line item, create TWO separate ExtractedActivity rows:
  - Row 1: unit_type = physical type (Weight/Volume/Energy/etc), quantity = physical amount
  - Row 2: unit_type = "Money", quantity = spend amount, unit = currency code
Mark the physical row as higher confidence.

══════════════════════════════════════════════════════════════
ExtractedActivity SCHEMA
══════════════════════════════════════════════════════════════

Populate each ExtractedActivity with:
  - search_query      (required) Short 2-5 word keyword query for Climatiq Search API
  - raw_text          (required) Original text as extracted (for audit trail)
  - unit_type         Inferred Climatiq unit type (exactly one, or blank)
  - quantity          Numeric value if detected
  - unit              Unit string if detected (e.g., "t", "kg", "kWh", "usd")
  - region            Region code if detected in document, else blank
  - source_document_id (required) Always set
  - source_page       Page number (PDF) or sheet+row (Excel) for traceability
  - confidence        HIGH / MEDIUM / LOW based on extraction certainty
  - category          One of: HARDWARE, CONSTRUCTION, ENERGY, TRANSPORT,
                      OPERATIONS, PROCUREMENT, WASTE, WATER, OTHER
                      Infer from keywords in the raw text.

══════════════════════════════════════════════════════════════
JOB PROGRESS
══════════════════════════════════════════════════════════════

Keep job progress updates:
  stage = "reading_files" → "parsing" → "extracting" → "normalizing_queries" → "writing_activities" → "done"
  progress increases monotonically (0-100).

If parsing fails for one document:
  - Mark that document as failed with error message
  - Continue processing remaining documents
  - Mark overall job as "partial" if some docs succeeded, "failed" if none did
  - Keep all partial results

══════════════════════════════════════════════════════════════
ACCEPTANCE CRITERIA
══════════════════════════════════════════════════════════════

- Upload a PDF and XLSX → extraction creates rows based on actual content.
- Each activity row has source_document_id and source_page.
- search_query values are 2-5 words, no brand names, no long descriptions.
- unit_type is one valid Climatiq value or blank — never an invalid string.
- When a line item has both quantity and spend, two rows are created.
- Job progress reports stage transitions smoothly.