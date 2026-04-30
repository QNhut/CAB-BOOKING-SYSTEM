from typing import Literal

from pydantic import BaseModel, Field


DispatchObjective = Literal["balanced", "fastest", "cheapest", "best_rated"]


class DriverCandidate(BaseModel):
    driver_id: str
    distance_km: float | None = None
    rating: float | None = None
    is_online: bool = True
    eta_min: float | None = None
    price_k: float | None = None


class FailureInjection(BaseModel):
    eta_fail_attempts: int = 0
    pricing_fail_attempts: int = 0
    ai_model_fail: bool = False


class ObjectiveWeights(BaseModel):
    eta: float = 0.35
    price: float = 0.25
    rating: float = 0.25
    distance: float = 0.15


class DispatchRequest(BaseModel):
    user_id: str
    pickup: str
    dropoff: str
    drivers: list[DriverCandidate] = Field(default_factory=list)
    objective: DispatchObjective = "balanced"
    weights: ObjectiveWeights = Field(default_factory=ObjectiveWeights)
    failure_injection: FailureInjection = Field(default_factory=FailureInjection)
    trace_id: str | None = None


class ToolCallLog(BaseModel):
    tool: str
    driver_id: str
    attempts: int
    status: Literal["used", "skipped", "failed", "fallback"]
    message: str


class DriverScore(BaseModel):
    driver_id: str
    score: float
    components: dict[str, float]


class RetryReport(BaseModel):
    eta_retries: int = 0
    pricing_retries: int = 0


class DispatchResponse(BaseModel):
    trace_id: str
    status: Literal[
        "selected",
        "fallback_selected",
        "need_more_context",
        "no_driver_available",
    ]
    selected_driver_id: str | None = None
    reason: str
    filtered_offline_drivers: list[str] = Field(default_factory=list)
    missing_context_fields: list[str] = Field(default_factory=list)
    tool_calls: list[ToolCallLog] = Field(default_factory=list)
    driver_scores: list[DriverScore] = Field(default_factory=list)
    retry_report: RetryReport = Field(default_factory=RetryReport)
