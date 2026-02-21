"""
Climatiq-based mapping pipeline: cache → search → estimate → ranking.
Used by the mapping job runner.
"""
from __future__ import annotations

from typing import Any, Callable

from app.climatiq_client import (
    DATA_VERSION,
    BuildParamsInput,
    build_parameters,
    estimate_batch,
    estimate_single,
    map_region_to_climatiq,
    search_factors,
)
from app.jobs.gemini_estimation import estimate_co2e_with_gemini
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

BATCH_CHUNK_SIZE = 100
CONFIDENCE_FROM_LEVEL = {"high": 0.9, "medium": 0.75, "low": 0.55}


# ─── Helpers ──────────────────────────────────────────────────────────────


def _factor_unit(factor: dict[str, Any]) -> str | None:
    ut = factor.get("unit_type")
    if isinstance(ut, list):
        return ut[0] if ut else None
    return ut


def _build_estimate(
    activity: ExtractedActivity,
    factor: dict[str, Any],
    result_ef: dict[str, Any],
    co2e_kg: float,
    confidence_level: str,
    confidence_mult: float = 1.0,
) -> ActivityEstimate:
    ef_or_factor = result_ef if result_ef else factor
    return ActivityEstimate(
        activityId=activity.id,
        region=activity.region,
        matchedFactor=MatchedFactor(
            id=ef_or_factor.get("activity_id", factor.get("activity_id", "?")),
            name=ef_or_factor.get("name", factor.get("name", "?")),
            source=ef_or_factor.get("source", factor.get("source", "N/A")),
            year=ef_or_factor.get("year", factor.get("year")),
            unit=_factor_unit(ef_or_factor) or _factor_unit(factor),
        ),
        confidence=CONFIDENCE_FROM_LEVEL.get(confidence_level, 0.55) * confidence_mult,
        co2eKg=co2e_kg,
        inputUsed=EstimateInputUsed(
            unit_type=activity.unit_type,
            quantity=activity.quantity,
            amount=activity.amount,
            currency=activity.currency,
        ),
        mapping_confidence=confidence_level,
    )


def _estimate_from_cache(activity_id: str, cached: dict) -> ActivityEstimate:
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


def _make_zero_estimate(
    activity: ExtractedActivity,
) -> ActivityEstimate:
    return ActivityEstimate(
        activityId=activity.id,
        region=activity.region,
        matchedFactor=MatchedFactor(
            id="unmatched", name="No factor matched", source="N/A", year=None, unit=None
        ),
        confidence=0.2,
        co2eKg=0.0,
        inputUsed=EstimateInputUsed(
            unit_type=activity.unit_type,
            quantity=activity.quantity,
            amount=activity.amount,
            currency=activity.currency,
        ),
        mapping_confidence="low",
    )


def _make_needs_quantity_estimate(
    activity: ExtractedActivity,
    factor: dict[str, Any],
    confidence_level: str,
) -> ActivityEstimate:
    return ActivityEstimate(
        activityId=activity.id,
        region=activity.region,
        matchedFactor=MatchedFactor(
            id=factor.get("activity_id", "unknown"),
            name=factor.get("name", "Unknown"),
            source=factor.get("source", "N/A"),
            year=factor.get("year"),
            unit=_factor_unit(factor),
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


_CLIMATIQ_UT_MAP: dict[str, str] = {
    "weight": "Weight",
    "energy": "Energy",
    "power": "Power",
    "volume": "Volume",
    "area": "Area",
    "distance": "Distance",
    "money": "Money",
    "number": "Number",
    "data": "Data",
    "time": "Time",
    "weightoverdistance": "WeightOverDistance",
    "weight_over_distance": "WeightOverDistance",
    "containeroverdistance": "ContainerOverDistance",
    "container_over_distance": "ContainerOverDistance",
    "passengeroverdistance": "PassengerOverDistance",
    "passenger_over_distance": "PassengerOverDistance",
    "areaovertime": "AreaOverTime",
    "area_over_time": "AreaOverTime",
    "dataovertime": "DataOverTime",
    "data_over_time": "DataOverTime",
    "distanceovertime": "DistanceOverTime",
    "distance_over_time": "DistanceOverTime",
    "numberovertime": "NumberOverTime",
    "number_over_time": "NumberOverTime",
    "weightovertime": "WeightOverTime",
    "weight_over_time": "WeightOverTime",
}


def _climatiq_ut_to_our_ut(climatiq_ut: str) -> str | None:
    """Map Climatiq lowercase unit_type string to our title-case enum value."""
    if not climatiq_ut:
        return None
    return _CLIMATIQ_UT_MAP.get(climatiq_ut.lower().replace("-", "_"), climatiq_ut)


def _retry_with_factor_unit_types(
    activity: ExtractedActivity,
    factor: dict[str, Any],
    climatiq_region: str,
) -> "EstimateResult | None":
    """Try estimate_single for each unit_type the factor accepts.

    Skips the unit_type that was already tried in the batch (activity.unit_type).
    Returns the first successful EstimateResult, or None.
    """
    from app.climatiq_client import EstimateResult  # local import to avoid circular

    factor_ut_list = factor.get("unit_type") or []
    if not isinstance(factor_ut_list, list):
        factor_ut_list = [factor_ut_list] if factor_ut_list else []

    for climatiq_ut in factor_ut_list:
        if not climatiq_ut:
            continue
        our_ut = _climatiq_ut_to_our_ut(str(climatiq_ut))
        # Skip unit types that have no data on the activity
        if our_ut == "Money" and activity.amount is None:
            continue
        if our_ut in ("Weight", "Energy", "Volume", "Distance", "Number", "Power", "Area", "Data", "Time") and activity.quantity is None:
            continue

        try:
            params = build_parameters(
                BuildParamsInput(our_ut, activity.quantity, activity.unit, activity.amount, activity.currency),
                [climatiq_ut],
            )
            result = estimate_single(factor["activity_id"], params, region=climatiq_region)
            if result and not result.error and result.co2e > 0:
                return result
        except Exception:
            continue

    return None


def _make_gemini_estimate(
    activity: ExtractedActivity,
    factor: dict[str, Any] | None,
    co2e_kg: float,
) -> ActivityEstimate:
    """Build an ActivityEstimate from a Gemini-generated CO2e value."""
    return ActivityEstimate(
        activityId=activity.id,
        region=activity.region,
        matchedFactor=MatchedFactor(
            id=factor.get("activity_id", "gemini-estimate") if factor else "gemini-estimate",
            name=factor.get("name", "Gemini AI Estimate") if factor else "Gemini AI Estimate",
            source="Gemini AI",
            year=None,
            unit=_factor_unit(factor) if factor else None,
        ),
        confidence=0.45,
        co2eKg=co2e_kg,
        inputUsed=EstimateInputUsed(
            unit_type=activity.unit_type,
            quantity=activity.quantity,
            amount=activity.amount,
            currency=activity.currency,
            note="gemini_fallback",
        ),
        mapping_confidence="low",
    )


def _store_cache(
    cache_key: str,
    activity: ExtractedActivity,
    factor: dict[str, Any],
    result_ef: dict[str, Any],
    co2e_kg: float,
    confidence_level: str,
) -> None:
    ef = result_ef if result_ef else factor
    set_cached(
        cache_key,
        activity_id=ef.get("activity_id", factor.get("activity_id", "?")),
        factor_name=ef.get("name", factor.get("name", "?")),
        factor_source=ef.get("source", factor.get("source", "N/A")),
        factor_year=ef.get("year", factor.get("year")),
        factor_region=ef.get("region"),
        factor_unit=_factor_unit(ef) or _factor_unit(factor),
        factor_unit_type=None,
        co2e_per_unit=None,
        co2e_kg=co2e_kg,
        quantity=activity.quantity,
        unit=activity.unit,
        confidence=confidence_level,
    )


# ─── Pipeline ─────────────────────────────────────────────────────────────


def run_mapping_pipeline(
    project: Project,
    activities: list[ExtractedActivity],
    progress_cb: Callable[[int, str, str], None] | None = None,
    gemini_api_key: str | None = None,
) -> list[ActivityEstimate]:
    """
    Run cache → search → estimate → ranking. progress_cb(progress, stage, message).

    Progress bands:
      10–15  loading / cache check
      15–50  searching emission factors (one Climatiq search call per activity)
      50–85  estimating (batched, progress per chunk of 100)
      85–95  ranking
      95–100 done
    """
    total = len(activities)
    if total == 0:
        return []

    regions = [project.primaryRegion, *(project.comparisonRegions or [])]
    if not regions:
        regions = ["global"]

    estimates_out: list[ActivityEstimate] = []
    # Items that need a live Climatiq estimate call
    to_estimate: list[tuple[ExtractedActivity, dict, dict, str, str, str]] = []
    # (activity, factor, params, climatiq_region, confidence_level, cache_key)

    def report(progress: int, stage: str, message: str) -> None:
        if progress_cb:
            progress_cb(progress, stage, message)

    # ── Phase 1: search / cache ─────────────────────────────────────────
    report(10, "loading_activities", f"Loaded {total} activities")
    report(15, "searching_factors", "Searching emission factors…")

    for i, activity in enumerate(activities):
        pct = 15 + int((i / total) * 35)
        report(pct, "searching_factors", f"Searching factor {i + 1}/{total}")

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
            # Overlay live activity input fields onto cached estimate
            estimates_out.append(ActivityEstimate(
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
            ))
            continue

        search_result = search_factors(
            search_query,
            region=climatiq_region,
            unit_type=activity.unit_type,
            results_per_page=5,
        )
        factor = search_result.results[0] if search_result.results else None
        confidence_level = {
            "none": "high",
            "no_region": "medium",
            "no_region_no_unit": "low",
            "all_failed": "low",
            "stub": "medium",
        }.get(search_result.fallback_used, "low")

        if not factor:
            if gemini_api_key:
                co2e = estimate_co2e_with_gemini(
                    gemini_api_key, activity.text, activity.quantity, activity.unit, activity.unit_type
                )
                if co2e is not None and co2e > 0:
                    estimates_out.append(_make_gemini_estimate(activity, None, co2e))
                    continue
            estimates_out.append(_make_zero_estimate(activity))
            continue

        if activity.quantity is None and activity.amount is None:
            estimates_out.append(_make_needs_quantity_estimate(activity, factor, confidence_level))
            continue

        factor_unit_types = factor.get("unit_type")
        if not isinstance(factor_unit_types, list):
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

    # ── Phase 2: batch estimate ─────────────────────────────────────────
    n_to_estimate = len(to_estimate)
    report(50, "estimating", f"Estimating {n_to_estimate} activities in batches…")

    for chunk_start in range(0, n_to_estimate, BATCH_CHUNK_SIZE):
        chunk = to_estimate[chunk_start: chunk_start + BATCH_CHUNK_SIZE]
        chunk_end = min(chunk_start + BATCH_CHUNK_SIZE, n_to_estimate)

        # Report progress at the start of each chunk (50–85 band)
        pct = 50 + int((chunk_start / max(1, n_to_estimate)) * 35)
        report(
            pct,
            "estimating",
            f"Estimating activities {chunk_start + 1}–{chunk_end} of {n_to_estimate}",
        )

        batch_body: list[dict] = []
        for act, fac, par, clim_region, _, _ in chunk:
            item: dict = {
                "emission_factor": {
                    "activity_id": fac["activity_id"],
                    "data_version": DATA_VERSION,
                },
                "parameters": par,
            }
            if clim_region and clim_region != "GLOBAL":
                item["emission_factor"]["region"] = clim_region
            batch_body.append(item)

        # estimate_batch handles the actual HTTP call (and retries)
        results = estimate_batch(batch_body)

        for (activity, factor, params, clim_region_item, confidence_level, cache_key), result in zip(chunk, results):
            if result.error:
                # Step 1: Retry with each accepted unit_type from the factor
                retry = _retry_with_factor_unit_types(activity, factor, clim_region_item)
                if retry and not retry.error and retry.co2e > 0:
                    _store_cache(cache_key, activity, factor, retry.emission_factor, retry.co2e, confidence_level)
                    estimates_out.append(
                        _build_estimate(activity, factor, retry.emission_factor, retry.co2e, confidence_level)
                    )
                    continue

                # Step 2: Gemini fallback estimation
                if gemini_api_key:
                    co2e = estimate_co2e_with_gemini(
                        gemini_api_key,
                        activity.text,
                        activity.quantity,
                        activity.unit,
                        activity.unit_type,
                        factor_name=factor.get("name"),
                        factor_unit=_factor_unit(factor),
                    )
                    if co2e is not None and co2e > 0:
                        estimates_out.append(_make_gemini_estimate(activity, factor, co2e))
                        continue

                # Step 3: Zero estimate with reduced confidence
                estimates_out.append(
                    _build_estimate(activity, factor, {}, 0.0, confidence_level, confidence_mult=0.5)
                )
                continue

            co2e_kg = result.co2e  # always kg_co2e from Climatiq
            _store_cache(cache_key, activity, factor, result.emission_factor, co2e_kg, confidence_level)
            estimates_out.append(
                _build_estimate(activity, factor, result.emission_factor, co2e_kg, confidence_level)
            )

        # Report progress at the end of each chunk
        pct_after = 50 + int((chunk_end / max(1, n_to_estimate)) * 35)
        report(
            pct_after,
            "estimating",
            f"Estimated {chunk_end}/{n_to_estimate} activities",
        )

    # ── Phase 3: ranking ────────────────────────────────────────────────
    report(85, "ranking", "Ranking estimates by CO₂e…")

    has_multi_region = bool(project.comparisonRegions)
    if has_multi_region:
        for region in regions:
            region_ests = [e for e in estimates_out if e.region == region]
            region_ests.sort(key=lambda e: e.co2eKg, reverse=True)
            # Build a replacement map for this region
            ranked_ids: dict[str, int] = {}  # activityId → rank_position
            for rank, est in enumerate(region_ests[:50], start=1):
                ranked_ids[est.activityId] = rank

            estimates_out = [
                ActivityEstimate(
                    activityId=e.activityId,
                    region=e.region,
                    matchedFactor=e.matchedFactor,
                    confidence=e.confidence,
                    co2eKg=e.co2eKg,
                    inputUsed=e.inputUsed,
                    rank_position=ranked_ids.get(e.activityId) if e.region == region else e.rank_position,
                    selected=e.activityId in ranked_ids if e.region == region else e.selected,
                    mapping_confidence=e.mapping_confidence,
                )
                for e in estimates_out
            ]
    else:
        sorted_est = sorted(estimates_out, key=lambda e: (e.co2eKg, e.activityId or ""), reverse=True)
        ranked: list[ActivityEstimate] = []
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
