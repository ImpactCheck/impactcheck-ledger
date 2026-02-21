"""
Climatiq-based mapping pipeline: cache → search → estimate → ranking.
Used by the mapping job runner.
"""
from __future__ import annotations

from typing import Callable

from app.climatiq_client import (
    DATA_VERSION,
    BuildParamsInput,
    build_parameters,
    estimate_batch,
    estimate_single,
    map_region_to_climatiq,
    search_factors,
)
from app.models import (
    ActivityEstimate,
    EstimateInputUsed,
    ExtractedActivity,
    MatchedFactor,
    Project,
)
from app.storage.cache_repo import (
    build_cache_key,
    get_cached,
    set_cached,
)
CONFIDENCE_FROM_LEVEL = {"high": 0.9, "medium": 0.75, "low": 0.55}


def _estimate_from_cache(activity_id: str, cached: dict) -> ActivityEstimate:
    """Build estimate from cache row; activity_id is the project activity id."""
    return ActivityEstimate(
        activityId=activity_id,
        region=cached.get("factor_region"),
        matchedFactor=MatchedFactor(
            id=cached["activity_id"],
            name=cached["factor_name"],
            source=cached["factor_source"],
            year=cached.get("factor_year"),
            unit=cached.get("factor_unit"),
        ),
        confidence=CONFIDENCE_FROM_LEVEL.get(cached.get("confidence", "medium"), 0.75),
        co2eKg=float(cached["co2e_kg"]),
        inputUsed=EstimateInputUsed(
            quantity=cached.get("quantity"),
            unit=cached.get("unit"),
            note=None,
        ),
        mapping_confidence=cached.get("confidence"),
    )


def _make_zero_estimate(activity_id: str, region: str | None, input_used: EstimateInputUsed) -> ActivityEstimate:
    return ActivityEstimate(
        activityId=activity_id,
        region=region,
        matchedFactor=MatchedFactor(id="unmatched", name="No factor matched", source="N/A", year=None, unit=None),
        confidence=0.2,
        co2eKg=0.0,
        inputUsed=input_used,
        mapping_confidence="low",
    )


def _make_needs_quantity_estimate(
    activity: ExtractedActivity,
    factor: dict,
    confidence_level: str,
) -> ActivityEstimate:
    unit = (factor.get("unit_type") or ["weight"])[0] if isinstance(factor.get("unit_type"), list) else factor.get("unit_type")
    return ActivityEstimate(
        activityId=activity.id,
        region=activity.region,
        matchedFactor=MatchedFactor(
            id=factor.get("activity_id", "unknown"),
            name=factor.get("name", "Unknown"),
            source=factor.get("source", "N/A"),
            year=factor.get("year"),
            unit=unit,
        ),
        confidence=CONFIDENCE_FROM_LEVEL.get(confidence_level, 0.55) * 0.5,
        co2eKg=0.0,
        inputUsed=EstimateInputUsed(
            unit_type=activity.unit_type,
            quantity=None,
            amount=None,
            currency=None,
            note="needs_quantity",
        ),
        mapping_confidence=confidence_level,
    )


def run_mapping_pipeline(
    project: Project,
    activities: list[ExtractedActivity],
    progress_cb: Callable[[int, str, str], None] | None = None,
) -> list[ActivityEstimate]:
    """
    Run cache → search → estimate → ranking. progress_cb(progress, stage, message).
    """
    total = len(activities)
    if total == 0:
        return []

    regions = [project.primaryRegion, *(project.comparisonRegions or [])]
    if not regions:
        regions = ["global"]
    project_region = map_region_to_climatiq(project.primaryRegion)

    estimates_out: list[ActivityEstimate] = []
    to_estimate: list[tuple[ExtractedActivity, dict, dict, str, str, str]] = []  # activity, factor, params, region, confidence_level, cache_key

    def report(progress: int, stage: str, message: str) -> None:
        if progress_cb:
            progress_cb(progress, stage, message)

    report(10, "loading_activities", f"Loaded {total} activities")
    report(15, "searching_factors", "Searching emission factors")

    for i, activity in enumerate(activities):
        pct = 15 + int((i / total) * 35)
        report(pct, "searching_factors", f"Searching ({i + 1}/{total})")

        search_query = activity.search_query or activity.text
        region = activity.region or project.primaryRegion
        climatiq_region = map_region_to_climatiq(region)
        cache_key = build_cache_key(
            search_query, region, activity.unit_type,
            activity.quantity, activity.unit,
        )
        cached = get_cached(cache_key)
        if cached:
            est = _estimate_from_cache(activity.id, cached)
            est = ActivityEstimate(
                activityId=activity.id,
                region=activity.region,
                matchedFactor=est.matchedFactor,
                confidence=est.confidence,
                co2eKg=est.co2eKg,
                inputUsed=EstimateInputUsed(
                    unit_type=activity.unit_type,
                    quantity=activity.quantity,
                    amount=activity.amount,
                    currency=activity.currency,
                    note=None,
                ),
                mapping_confidence=est.mapping_confidence,
            )
            estimates_out.append(est)
            continue

        search_result = search_factors(
            search_query,
            region=climatiq_region,
            unit_type=activity.unit_type,
            results_per_page=5,
        )
        factor = search_result.results[0] if search_result.results else None
        confidence_level = {"none": "high", "no_region": "medium", "no_region_no_unit": "low", "all_failed": "low", "stub": "medium"}.get(search_result.fallback_used, "low")

        if not factor:
            estimates_out.append(_make_zero_estimate(
                activity.id,
                activity.region,
                EstimateInputUsed(unit_type=activity.unit_type, quantity=activity.quantity, amount=activity.amount, currency=activity.currency),
            ))
            continue

        if activity.quantity is None and activity.amount is None:
            estimates_out.append(_make_needs_quantity_estimate(activity, factor, confidence_level))
            continue

        factor_unit_types = factor.get("unit_type")
        if isinstance(factor_unit_types, list):
            pass
        else:
            factor_unit_types = [factor_unit_types] if factor_unit_types else None
        params = build_parameters(
            BuildParamsInput(
                activity.unit_type,
                activity.quantity,
                activity.unit,
                activity.amount,
                activity.currency,
            ),
            factor_unit_types,
        )
        to_estimate.append((activity, factor, params, climatiq_region, confidence_level, cache_key))

    report(50, "estimating", f"Estimating {len(to_estimate)} activities")
    batch_size = len(to_estimate)

    if batch_size >= 5:
        for chunk_start in range(0, batch_size, 100):
            chunk = to_estimate[chunk_start : chunk_start + 100]
            batch_body = []
            for act, fac, par, clim_region, _, _ in chunk:
                b = {
                    "emission_factor": {"activity_id": fac["activity_id"], "data_version": DATA_VERSION},
                    "parameters": par,
                }
                if clim_region and clim_region != "GLOBAL":
                    b["emission_factor"]["region"] = clim_region
                batch_body.append(b)
            results = estimate_batch(batch_body)
            for (activity, factor, params, _, confidence_level, cache_key), result in zip(chunk, results):
                if result.error:
                    estimates_out.append(ActivityEstimate(
                        activityId=activity.id,
                        region=activity.region,
                        matchedFactor=MatchedFactor(
                            id=factor.get("activity_id", "?"),
                            name=factor.get("name", "?"),
                            source=factor.get("source", "N/A"),
                            year=factor.get("year"),
                            unit=factor.get("unit_type", [None])[0] if isinstance(factor.get("unit_type"), list) else factor.get("unit_type"),
                        ),
                        confidence=CONFIDENCE_FROM_LEVEL.get(confidence_level, 0.55) * 0.5,
                        co2eKg=0.0,
                        inputUsed=EstimateInputUsed(unit_type=activity.unit_type, quantity=activity.quantity, amount=activity.amount, currency=activity.currency),
                        mapping_confidence=confidence_level,
                    ))
                    continue
                co2e_kg = result.co2e if result.co2e_unit == "kg_co2e" else result.co2e
                ef = result.emission_factor
                set_cached(
                    cache_key,
                    activity_id=ef.get("activity_id", factor.get("activity_id", "?")),
                    factor_name=ef.get("name", factor.get("name", "?")),
                    factor_source=ef.get("source", factor.get("source", "N/A")),
                    factor_year=ef.get("year", factor.get("year")),
                    factor_region=ef.get("region"),
                    factor_unit=ef.get("unit_type", [None])[0] if isinstance(ef.get("unit_type"), list) else ef.get("unit_type"),
                    factor_unit_type=None,
                    co2e_per_unit=None,
                    co2e_kg=co2e_kg,
                    quantity=activity.quantity,
                    unit=activity.unit,
                    confidence=confidence_level,
                )
                estimates_out.append(ActivityEstimate(
                    activityId=activity.id,
                    region=activity.region,
                    matchedFactor=MatchedFactor(
                        id=ef.get("activity_id", factor.get("activity_id", "?")),
                        name=ef.get("name", factor.get("name", "?")),
                        source=ef.get("source", factor.get("source", "N/A")),
                        year=ef.get("year", factor.get("year")),
                        unit=ef.get("unit_type", [None])[0] if isinstance(ef.get("unit_type"), list) else ef.get("unit_type"),
                    ),
                    confidence=CONFIDENCE_FROM_LEVEL.get(confidence_level, 0.75),
                    co2eKg=co2e_kg,
                    inputUsed=EstimateInputUsed(unit_type=activity.unit_type, quantity=activity.quantity, amount=activity.amount, currency=activity.currency),
                    mapping_confidence=confidence_level,
                ))
    else:
        for j, (activity, factor, params, climatiq_region, confidence_level, cache_key) in enumerate(to_estimate):
            pct = 50 + int((j + 1) / max(1, len(to_estimate)) * 35)
            report(pct, "estimating", f"Estimating ({j + 1}/{len(to_estimate)})")
            result = estimate_single(factor["activity_id"], params, region=climatiq_region if climatiq_region != "GLOBAL" else None)
            if result.error:
                estimates_out.append(ActivityEstimate(
                    activityId=activity.id,
                    region=activity.region,
                    matchedFactor=MatchedFactor(
                        id=factor.get("activity_id", "?"),
                        name=factor.get("name", "?"),
                        source=factor.get("source", "N/A"),
                        year=factor.get("year"),
                        unit=factor.get("unit_type", [None])[0] if isinstance(factor.get("unit_type"), list) else factor.get("unit_type"),
                    ),
                    confidence=CONFIDENCE_FROM_LEVEL.get(confidence_level, 0.55) * 0.5,
                    co2eKg=0.0,
                    inputUsed=EstimateInputUsed(unit_type=activity.unit_type, quantity=activity.quantity, amount=activity.amount, currency=activity.currency),
                    mapping_confidence=confidence_level,
                ))
                continue
            co2e_kg = result.co2e if result.co2e_unit == "kg_co2e" else result.co2e
            ef = result.emission_factor
            set_cached(
                cache_key,
                activity_id=ef.get("activity_id", factor.get("activity_id", "?")),
                factor_name=ef.get("name", factor.get("name", "?")),
                factor_source=ef.get("source", factor.get("source", "N/A")),
                factor_year=ef.get("year", factor.get("year")),
                factor_region=ef.get("region"),
                factor_unit=ef.get("unit_type", [None])[0] if isinstance(ef.get("unit_type"), list) else ef.get("unit_type"),
                factor_unit_type=None,
                co2e_per_unit=None,
                co2e_kg=co2e_kg,
                quantity=activity.quantity,
                unit=activity.unit,
                confidence=confidence_level,
            )
            estimates_out.append(ActivityEstimate(
                activityId=activity.id,
                region=activity.region,
                matchedFactor=MatchedFactor(
                    id=ef.get("activity_id", factor.get("activity_id", "?")),
                    name=ef.get("name", factor.get("name", "?")),
                    source=ef.get("source", factor.get("source", "N/A")),
                    year=ef.get("year", factor.get("year")),
                    unit=ef.get("unit_type", [None])[0] if isinstance(ef.get("unit_type"), list) else ef.get("unit_type"),
                ),
                confidence=CONFIDENCE_FROM_LEVEL.get(confidence_level, 0.75),
                co2eKg=co2e_kg,
                inputUsed=EstimateInputUsed(unit_type=activity.unit_type, quantity=activity.quantity, amount=activity.amount, currency=activity.currency),
                mapping_confidence=confidence_level,
            ))

    report(88, "ranking", "Ranking estimates")
    has_multi_region = bool(project.comparisonRegions)
    if has_multi_region:
        for region in regions:
            region_estimates = [e for e in estimates_out if e.region == region]
            region_estimates.sort(key=lambda e: e.co2eKg, reverse=True)
            for rank, est in enumerate(region_estimates[:50], start=1):
                idx = next(i for i, e in enumerate(estimates_out) if e.activityId == est.activityId and e.region == est.region)
                estimates_out[idx] = ActivityEstimate(
                    activityId=est.activityId,
                    region=est.region,
                    matchedFactor=est.matchedFactor,
                    confidence=est.confidence,
                    co2eKg=est.co2eKg,
                    inputUsed=est.inputUsed,
                    rank_position=rank,
                    selected=True,
                    mapping_confidence=est.mapping_confidence,
                )
            for est in region_estimates[50:]:
                idx = next(i for i, e in enumerate(estimates_out) if e.activityId == est.activityId and e.region == est.region)
                estimates_out[idx] = ActivityEstimate(
                    activityId=est.activityId,
                    region=est.region,
                    matchedFactor=est.matchedFactor,
                    confidence=est.confidence,
                    co2eKg=est.co2eKg,
                    inputUsed=est.inputUsed,
                    rank_position=None,
                    selected=False,
                    mapping_confidence=est.mapping_confidence,
                )
    else:
        sorted_est = sorted(estimates_out, key=lambda e: (e.co2eKg, e.activityId or ""), reverse=True)
        ranked = []
        for rank, est in enumerate(sorted_est[:100], start=1):
            ranked.append(ActivityEstimate(
                activityId=est.activityId,
                region=est.region,
                matchedFactor=est.matchedFactor,
                confidence=est.confidence,
                co2eKg=est.co2eKg,
                inputUsed=est.inputUsed,
                rank_position=rank,
                selected=True,
                mapping_confidence=est.mapping_confidence,
            ))
        for est in sorted_est[100:]:
            ranked.append(ActivityEstimate(
                activityId=est.activityId,
                region=est.region,
                matchedFactor=est.matchedFactor,
                confidence=est.confidence,
                co2eKg=est.co2eKg,
                inputUsed=est.inputUsed,
                rank_position=None,
                selected=False,
                mapping_confidence=est.mapping_confidence,
            ))
        estimates_out = ranked

    report(100, "done", f"Mapped {len(estimates_out)} estimates")
    return estimates_out
