from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path

from app.models import (
    ActivityEstimate,
    CategoryBreakdownEntry,
    Compliance,
    ComplianceSide,
    Document,
    EstimateInputUsed,
    ExtractedActivity,
    Hotspot,
    MatchedFactor,
    Project,
    Recommendation,
    Report,
)


REGION_GRID_INTENSITY: dict[str, int] = {
    "texas_ercot": 380,
    "norway_hydro": 10,
    "virginia_pjm": 310,
    "iowa_miso": 420,
    "iceland_geo": 15,
    "singapore": 408,
}


@dataclass(frozen=True)
class ActivityTemplate:
    text: str
    unit_type: str
    unit: str
    base_quantity: float
    spread: int
    category: str


ACTIVITY_TEMPLATES: list[ActivityTemplate] = [
    ActivityTemplate("NVIDIA GB200 NVL72 rack manufacturing", "Weight", "racks", 120, 220, "Hardware"),
    ActivityTemplate("Liquid cooling unit production", "Weight", "units", 45, 80, "Hardware"),
    ActivityTemplate("Standard concrete pouring foundation", "Weight", "MT", 8_000, 9_000, "Construction"),
    ActivityTemplate("Steel rebar fabrication", "Weight", "MT", 2_000, 2_800, "Construction"),
    ActivityTemplate("Diesel backup generator commissioning", "Energy", "MWh", 350, 450, "Energy"),
    ActivityTemplate("Grid electricity operational year", "Energy", "MWh", 2_900_000, 1_400_000, "Energy"),
    ActivityTemplate("Transformer and switchgear manufacturing", "Weight", "MT", 180, 220, "Hardware"),
    ActivityTemplate("Fiber optic cabling installation", "Distance", "km", 55, 70, "Infrastructure"),
    ActivityTemplate("HVAC ductwork and piping", "Weight", "MT", 500, 620, "Infrastructure"),
    ActivityTemplate("Server room fire suppression system procurement", "Money", "USD", 620_000, 580_000, "Infrastructure"),
    ActivityTemplate("UPS battery bank manufacturing", "Weight", "MT", 210, 260, "Hardware"),
    ActivityTemplate("Construction workforce transportation", "Money", "USD", 180_000, 130_000, "Transport"),
]


RECOMMENDATION_TEMPLATES = [
    (
        "Low-Carbon Materials Swap",
        "Replace high-impact embodied materials for hotspot '{hotspot}' with certified low-carbon alternatives.",
        "Source verified low-carbon suppliers and phase-in replacement across procurement cycles.",
        ["Supplier qualification window", "Lead-time impact during onboarding", "Regional code approval checks"],
    ),
    (
        "Renewable Power Mix Upgrade",
        "Shift energy sourcing tied to '{hotspot}' toward renewable PPAs and on-site clean generation.",
        "Execute blended PPA plus on-site generation plan aligned to baseline reduction milestones.",
        ["PPA negotiation lead-time", "Grid interconnection queue", "Treasury approval for long contracts"],
    ),
    (
        "Cooling and PUE Optimization",
        "Tune thermal systems associated with '{hotspot}' to reduce operational load and losses.",
        "Deploy advanced cooling controls, containment improvements, and quarterly PUE audits.",
        ["Retrofit outage planning", "Capital approval gating", "Vendor commissioning bandwidth"],
    ),
    (
        "Supply Chain Consolidation",
        "Consolidate fragmented vendors linked to '{hotspot}' into high-efficiency logistics lanes.",
        "Standardize supplier scorecards and reduce redundant transport/manufacturing steps.",
        ["Contract renegotiation cycles", "Dual-source resiliency requirements", "Customs timeline variability"],
    ),
    (
        "Design Standard Refactor",
        "Refactor engineering standards around '{hotspot}' to remove repeated high-emission patterns.",
        "Adopt design guardrails that cap embodied and operational emissions per deployment unit.",
        ["Engineering sign-off cadence", "Compatibility with legacy references", "Documentation backlog"],
    ),
    (
        "Regional Workload Rebalancing",
        "Move flexible workloads from high-intensity regions for hotspot '{hotspot}' into cleaner grids.",
        "Roll out region-aware scheduling policy with compliance tracking for migration outcomes.",
        ["Latency-sensitive service constraints", "Data residency policy reviews", "Capacity reservation lead-time"],
    ),
]


def stable_hash(value: str) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def _slug_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    cleaned = stem.replace("_", " ").replace("-", " ").strip()
    return " ".join(cleaned.split())


def build_extracted_activities(project: Project, documents: list[Document]) -> list[ExtractedActivity]:
    ordered_docs = sorted(documents, key=lambda d: d.id)
    filenames = [doc.filename for doc in ordered_docs] or ["manual_intake.csv"]
    seed = f"{project.id}|{'|'.join(filenames)}"

    count = 30 + (stable_hash(seed) % 51)  # 30-80 inclusive
    region_cycle = [project.primaryRegion, *(project.comparisonRegions or [])]
    if not region_cycle:
        region_cycle = ["global"]

    activities: list[ExtractedActivity] = []

    for idx in range(count):
        template = ACTIVITY_TEMPLATES[idx % len(ACTIVITY_TEMPLATES)]
        filename = filenames[idx % len(filenames)]
        source_doc = ordered_docs[idx % len(ordered_docs)] if ordered_docs else None
        source_label = _slug_from_filename(filename)
        region = region_cycle[idx % len(region_cycle)]

        variable = stable_hash(f"{seed}|{template.text}|{idx}")
        quantity = float(template.base_quantity + (variable % max(1, template.spread)))

        amount: float | None = None
        currency: str | None = None
        note = f"template={template.category.lower()} source={source_label}"
        unit = template.unit

        if template.unit_type == "Money":
            amount = float(quantity)
            currency = "USD"
            quantity_value: float | None = None
        else:
            quantity_value = quantity

        text = f"{template.text} ({source_label}) batch {(idx % 9) + 1}"

        activities.append(
            ExtractedActivity(
                id=f"act_{idx + 1:04d}",
                projectId=project.id,
                text=text,
                unit_type=template.unit_type,
                region=region,
                quantity=quantity_value,
                unit=unit,
                amount=amount,
                currency=currency,
                sourceDocumentId=source_doc.id if source_doc else None,
                note=note,
            )
        )

    return activities


def _infer_category(text: str) -> str:
    normalized = text.lower()
    if "concrete" in normalized or "rebar" in normalized or "foundation" in normalized:
        return "Construction"
    if "grid" in normalized or "diesel" in normalized or "electricity" in normalized:
        return "Energy"
    if "transport" in normalized or "commute" in normalized:
        return "Transport"
    if "cabling" in normalized or "hvac" in normalized or "suppression" in normalized:
        return "Infrastructure"
    return "Hardware"


def _grid_intensity(region: str | None) -> int:
    if not region:
        return 300

    key = region.lower()
    if key in REGION_GRID_INTENSITY:
        return REGION_GRID_INTENSITY[key]

    return 150 + (stable_hash(key) % 300)


def _co2e_for_activity(activity: ExtractedActivity, region: str) -> float:
    seed = f"{activity.text}|{activity.quantity}|{activity.amount}|{region}"
    base = 200 + (stable_hash(seed) % 450_000)

    quantity_component = 0.0
    if activity.quantity is not None:
        quantity_component = min(activity.quantity, 3_000_000) / 8.0
    elif activity.amount is not None:
        quantity_component = min(activity.amount, 15_000_000) / 400.0

    intensity_factor = _grid_intensity(region) / 320.0
    return round((base + quantity_component) * intensity_factor, 2)


def _confidence_for_activity(activity: ExtractedActivity, region: str) -> float:
    seed = f"{activity.id}|{activity.text}|{region}"
    return round(0.55 + ((stable_hash(seed) % 41) / 100.0), 2)


def build_activity_estimates(project: Project, activities: list[ExtractedActivity]) -> list[ActivityEstimate]:
    regions = [project.primaryRegion, *(project.comparisonRegions or [])]
    if not regions:
        regions = ["global"]

    estimates: list[ActivityEstimate] = []

    for region in regions:
        for activity in activities:
            category = _infer_category(activity.text)
            factor_hash = stable_hash(f"{category}|{region}|{activity.unit}")

            estimates.append(
                ActivityEstimate(
                    activityId=activity.id,
                    region=region,
                    matchedFactor=MatchedFactor(
                        id=f"ef_{factor_hash % 10_000:04d}",
                        name=category,
                        source="ImpactCheck Deterministic EF v2",
                        year=2025,
                        unit=activity.unit,
                    ),
                    confidence=_confidence_for_activity(activity, region),
                    co2eKg=_co2e_for_activity(activity, region),
                    inputUsed=EstimateInputUsed(
                        unit_type=activity.unit_type,
                        quantity=activity.quantity,
                        amount=activity.amount,
                        currency=activity.currency,
                    ),
                )
            )

    return estimates


def _compliance_side(total_kg: float, delta_kg: float | None, regime: str) -> ComplianceSide:
    if regime == "us":
        if total_kg > 2_200_000:
            status = "red"
            reasons = ["Primary region estimate exceeds high-reporting threshold for US scope disclosures."]
        elif total_kg > 1_200_000:
            status = "yellow"
            reasons = ["Primary region estimate exceeds voluntary-reduction threshold for US programs."]
        else:
            status = "green"
            reasons = ["Primary region estimate is below current mandatory US threshold bands."]
    else:
        if total_kg > 1_700_000:
            status = "red"
            reasons = ["Primary region estimate exceeds elevated CSRD/Taxonomy materiality band."]
        elif total_kg > 850_000:
            status = "yellow"
            reasons = ["Primary region estimate is in EU disclosure range; mitigation plan recommended."]
        else:
            status = "green"
            reasons = ["Primary region estimate sits below major EU mandatory reporting bands."]

    if delta_kg is not None and delta_kg > 0:
        reasons.append("Modeled footprint is above project baseline and requires corrective action.")
    elif delta_kg is not None and delta_kg <= 0:
        reasons.append("Modeled footprint is at or below project baseline trajectory.")

    return ComplianceSide(status=status, reasons=reasons)


def build_report(
    project: Project,
    activities: list[ExtractedActivity],
    estimates: list[ActivityEstimate],
) -> Report:
    totals_by_region: dict[str, float] = {}
    category_breakdown: dict[str, dict[str, float]] = {}

    for estimate in estimates:
        region = estimate.region or "global"
        totals_by_region[region] = round(totals_by_region.get(region, 0.0) + estimate.co2eKg, 2)

        if region not in category_breakdown:
            category_breakdown[region] = {}
        category_name = estimate.matchedFactor.name
        category_breakdown[region][category_name] = round(
            category_breakdown[region].get(category_name, 0.0) + estimate.co2eKg,
            2,
        )

    for region in [project.primaryRegion, *(project.comparisonRegions or [])]:
        totals_by_region.setdefault(region, 0.0)
        category_breakdown.setdefault(region, {})

    activity_by_id = {activity.id: activity for activity in activities}
    primary_region_estimates = [
        estimate for estimate in estimates if estimate.region == project.primaryRegion
    ]
    primary_region_estimates.sort(key=lambda item: item.co2eKg, reverse=True)

    hotspots: list[Hotspot] = []
    for estimate in primary_region_estimates[:5]:
        activity = activity_by_id.get(estimate.activityId)
        hotspots.append(
            Hotspot(
                text=activity.text if activity is not None else estimate.activityId,
                co2eKg=estimate.co2eKg,
            )
        )

    primary_total = totals_by_region.get(project.primaryRegion, 0.0)
    delta = None
    if project.baselineFootprintKgCO2e is not None:
        delta = round(primary_total - project.baselineFootprintKgCO2e, 2)

    breakdown_model: dict[str, list[CategoryBreakdownEntry]] = {}
    for region, categories in category_breakdown.items():
        breakdown_model[region] = [
            CategoryBreakdownEntry(category=category, co2eKg=value)
            for category, value in sorted(categories.items(), key=lambda item: item[1], reverse=True)
        ]

    return Report(
        projectId=project.id,
        totalsByRegion=totals_by_region,
        categoryBreakdownByRegion=breakdown_model,
        deltaVsBaselineKg=delta,
        compliance=Compliance(
            us=_compliance_side(primary_total, delta, "us"),
            eu=_compliance_side(primary_total, delta, "eu"),
        ),
        hotspots=hotspots,
    )


def build_recommendations(project: Project, report: Report) -> list[Recommendation]:
    hotspots = report.hotspots or [Hotspot(text="Core data-center operations", co2eKg=125_000.0)]
    recommendation_count = min(6, max(4, len(hotspots)))

    recommendations: list[Recommendation] = []

    for idx in range(recommendation_count):
        hotspot = hotspots[idx % len(hotspots)]
        template = RECOMMENDATION_TEMPLATES[idx % len(RECOMMENDATION_TEMPLATES)]
        seed = stable_hash(f"{project.id}|{hotspot.text}|{template[0]}|{idx}")

        reduction_ratio = 0.18 + ((seed % 18) / 100.0)
        expected_delta = -round(max(3_000.0, hotspot.co2eKg * reduction_ratio), 2)

        pool = template[3]
        constraint_count = 1 + (seed % 2)
        constraints = [pool[(seed + j) % len(pool)] for j in range(constraint_count)]

        recommendations.append(
            Recommendation(
                id=f"rec_{idx + 1:04d}",
                projectId=project.id,
                title=f"{template[0]} #{idx + 1}",
                summary=template[1].format(hotspot=hotspot.text),
                expectedDeltaKg=expected_delta,
                constraints=constraints,
                strategyDraftText=(
                    f"Target hotspot '{hotspot.text}' ({hotspot.co2eKg:,.0f} kg CO2e). "
                    f"{template[2]} Expected reduction: {abs(expected_delta):,.0f} kg CO2e."
                ),
            )
        )

    return recommendations


def build_final_strategy_text(project: Project, selected: list[Recommendation]) -> str:
    if not selected:
        return "No recommendations selected. Keep current baseline and rerun scenario generation."

    total_reduction = round(sum(abs(rec.expectedDeltaKg) for rec in selected), 2)
    titles = ", ".join(rec.title for rec in selected)

    return (
        f"Finalized strategy for {project.name} includes {len(selected)} recommendation(s): {titles}. "
        f"Combined projected reduction is {total_reduction:,.0f} kg CO2e against the modeled baseline."
    )
