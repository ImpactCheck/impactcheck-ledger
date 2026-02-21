from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


RegionCode = str
CompanyType = Literal["ai_infra", "other"]
UnitType = Literal["Money", "Weight", "Energy", "Distance", "Unknown"]

DocumentStatus = Literal["pending", "processing", "ready", "error"]
JobState = Literal["queued", "running", "succeeded", "failed"]
ComplianceStatus = Literal["green", "yellow", "red"]
DeploymentStatus = Literal["not_started", "running", "succeeded", "failed"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateProjectRequest(StrictModel):
    name: str = Field(min_length=1)
    year: int = Field(ge=2000, le=2100)
    companyType: CompanyType
    primaryRegion: RegionCode = Field(min_length=1)
    comparisonRegions: list[RegionCode] | None = None


class Project(StrictModel):
    id: str
    name: str
    year: int
    companyType: CompanyType
    primaryRegion: RegionCode
    comparisonRegions: list[RegionCode] | None = None
    baselineFootprintKgCO2e: float | None = None


class Document(StrictModel):
    id: str
    projectId: str
    filename: str
    fileType: str
    status: DocumentStatus
    uploadedAt: str
    jobId: str | None = None


class JobStatus(StrictModel):
    id: str
    type: str
    status: JobState
    progress: int = Field(ge=0, le=100)
    stage: str | None = None
    message: str | None = None
    createdAt: str
    updatedAt: str


class ExtractedActivity(StrictModel):
    id: str
    projectId: str
    text: str
    unit_type: UnitType | None = None
    region: RegionCode | None = None
    quantity: float | None = None
    unit: str | None = None
    amount: float | None = None
    currency: str | None = None
    sourceDocumentId: str | None = None
    note: str | None = None


class MatchedFactor(StrictModel):
    id: str
    name: str
    source: str
    year: int | None = None
    unit: str | None = None


class EstimateInputUsed(StrictModel):
    unit_type: UnitType | None = None
    quantity: float | None = None
    amount: float | None = None
    currency: str | None = None


class ActivityEstimate(StrictModel):
    activityId: str
    region: RegionCode | None = None
    matchedFactor: MatchedFactor
    confidence: float
    co2eKg: float
    inputUsed: EstimateInputUsed


class ComplianceSide(StrictModel):
    status: ComplianceStatus
    reasons: list[str]


class Compliance(StrictModel):
    us: ComplianceSide
    eu: ComplianceSide


class CategoryBreakdownEntry(StrictModel):
    category: str
    co2eKg: float


class Hotspot(StrictModel):
    text: str
    co2eKg: float


class Report(StrictModel):
    projectId: str
    totalsByRegion: dict[str, float]
    categoryBreakdownByRegion: dict[str, list[CategoryBreakdownEntry]] | None = None
    deltaVsBaselineKg: float | None = None
    compliance: Compliance
    hotspots: list[Hotspot]


class Recommendation(StrictModel):
    id: str
    projectId: str
    title: str
    summary: str
    expectedDeltaKg: float
    constraints: list[str] | None = None
    strategyDraftText: str


class FinalizeStrategyRequest(StrictModel):
    recommendationIds: list[str]


class FinalizeStrategyResponse(StrictModel):
    strategyText: str


class DeploymentPlan(StrictModel):
    projectId: str
    status: DeploymentStatus
    logs: list[str]


class JobIdResponse(StrictModel):
    jobId: str


class CsvResponse(StrictModel):
    csvText: str
