from __future__ import annotations

import json
import logging
import uuid
from typing import Any, TypedDict

from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import END, START, StateGraph

from app.agents.fallback import choose_with_rule_based
from app.agents.scoring import objective_weights, score_driver
from app.agents.tools import FailureController, ToolExecutionError, compute_eta, compute_price_k
from app.core.logging_config import log_event
from app.core.settings import load_settings
from app.models.schemas import (
    DispatchRequest,
    DispatchResponse,
    DriverCandidate,
    DriverScore,
    RetryReport,
    ToolCallLog,
)


class DispatchState(TypedDict, total=False):
    request: DispatchRequest
    trace_id: str
    status: str
    reason: str
    selected_driver_id: str | None
    filtered_offline_drivers: list[str]
    missing_context_fields: list[str]
    online_drivers: list[DriverCandidate]
    tool_calls: list[ToolCallLog]
    driver_scores: list[DriverScore]
    retry_report: RetryReport
    stop: bool
    failure_controller: FailureController


class DispatchAgent:
    def __init__(self) -> None:
        self.max_retry = 3
        self.settings = load_settings()
        self.llm = self._build_llm()
        self.graph = self._build_graph()

    def _build_graph(self):
        graph = StateGraph(DispatchState)
        graph.add_node("initialize", self._node_initialize)
        graph.add_node("filter_offline", self._node_filter_offline)
        graph.add_node("validate_context", self._node_validate_context)
        graph.add_node("enrich_tools", self._node_enrich_tools)
        graph.add_node("decide", self._node_decide)

        graph.add_edge(START, "initialize")
        graph.add_edge("initialize", "filter_offline")
        graph.add_edge("filter_offline", "validate_context")
        graph.add_conditional_edges(
            "validate_context",
            self._route_after_validation,
            {
                "stop": END,
                "continue": "enrich_tools",
            },
        )
        graph.add_edge("enrich_tools", "decide")
        graph.add_edge("decide", END)
        return graph.compile()

    def _build_llm(self) -> Any | None:
        if not self.settings.enable_llm_decision:
            return None

        if self.settings.llm_provider == "openai":
            if not self.settings.openai_api_key:
                return None
            from langchain_openai import ChatOpenAI

            return ChatOpenAI(
                api_key=self.settings.openai_api_key,
                model=self.settings.openai_model,
                temperature=0,
            )

        if self.settings.llm_provider == "google":
            if not self.settings.google_api_key:
                return None
            from langchain_google_genai import ChatGoogleGenerativeAI

            return ChatGoogleGenerativeAI(
                google_api_key=self.settings.google_api_key,
                model=self.settings.google_model,
                temperature=0,
            )

        return None

    def handle_dispatch(self, request: DispatchRequest) -> DispatchResponse:
        result = self.graph.invoke({"request": request})
        return DispatchResponse(
            trace_id=result["trace_id"],
            status=result["status"],
            selected_driver_id=result.get("selected_driver_id"),
            reason=result["reason"],
            filtered_offline_drivers=result.get("filtered_offline_drivers", []),
            missing_context_fields=result.get("missing_context_fields", []),
            tool_calls=result.get("tool_calls", []),
            driver_scores=result.get("driver_scores", []),
            retry_report=result.get("retry_report", RetryReport()),
        )

    def _node_initialize(self, state: DispatchState) -> DispatchState:
        request = state["request"]
        trace_id = request.trace_id or str(uuid.uuid4())
        log_event(
            logging.INFO,
            "dispatch_started",
            trace_id,
            user_id=request.user_id,
            objective=request.objective,
            drivers_count=len(request.drivers),
            graph_mode="langgraph",
            llm_enabled=self.llm is not None,
        )

        return {
            **state,
            "trace_id": trace_id,
            "tool_calls": [],
            "driver_scores": [],
            "retry_report": RetryReport(),
            "filtered_offline_drivers": [],
            "missing_context_fields": [],
            "stop": False,
        }

    def _node_filter_offline(self, state: DispatchState) -> DispatchState:
        request = state["request"]
        trace_id = state["trace_id"]
        offline_ids = [driver.driver_id for driver in request.drivers if not driver.is_online]
        online_drivers = [d.model_copy(deep=True) for d in request.drivers if d.is_online]
        log_event(logging.INFO, "filter_offline", trace_id, offline_count=len(offline_ids))

        return {
            **state,
            "filtered_offline_drivers": offline_ids,
            "online_drivers": online_drivers,
        }

    def _node_validate_context(self, state: DispatchState) -> DispatchState:
        trace_id = state["trace_id"]
        online_drivers = state["online_drivers"]
        if not online_drivers:
            return {
                **state,
                "status": "no_driver_available",
                "reason": "No online driver is available.",
                "stop": True,
            }

        missing_fields = self._collect_missing_context(online_drivers)
        if missing_fields:
            log_event(
                logging.WARNING,
                "missing_context",
                trace_id,
                missing_fields=missing_fields,
            )
            return {
                **state,
                "status": "need_more_context",
                "reason": "Driver context is incomplete. Need additional driver fields.",
                "missing_context_fields": missing_fields,
                "stop": True,
            }

        request = state["request"]
        return {
            **state,
            "failure_controller": FailureController(
                eta_fail_attempts=request.failure_injection.eta_fail_attempts,
                pricing_fail_attempts=request.failure_injection.pricing_fail_attempts,
            ),
        }

    def _route_after_validation(self, state: DispatchState) -> str:
        return "stop" if state.get("stop") else "continue"

    def _node_enrich_tools(self, state: DispatchState) -> DispatchState:
        request = state["request"]
        trace_id = state["trace_id"]
        online_drivers = state["online_drivers"]
        failure_controller = state["failure_controller"]
        tool_logs = state["tool_calls"]
        retry_report = state["retry_report"]

        eta_required, pricing_required = self._required_tools(request.objective)
        for driver in online_drivers:
            if eta_required:
                self._ensure_eta(driver, failure_controller, tool_logs, retry_report, trace_id)
            else:
                tool_logs.append(
                    ToolCallLog(
                        tool="eta",
                        driver_id=driver.driver_id,
                        attempts=0,
                        status="skipped",
                        message="ETA not required for this objective.",
                    )
                )
            if pricing_required:
                self._ensure_price(driver, failure_controller, tool_logs, retry_report, trace_id)
            else:
                tool_logs.append(
                    ToolCallLog(
                        tool="pricing",
                        driver_id=driver.driver_id,
                        attempts=0,
                        status="skipped",
                        message="Pricing not required for this objective.",
                    )
                )

        return {
            **state,
            "online_drivers": online_drivers,
            "tool_calls": tool_logs,
            "retry_report": retry_report,
        }

    def _node_decide(self, state: DispatchState) -> DispatchState:
        request = state["request"]
        trace_id = state["trace_id"]
        online_drivers = state["online_drivers"]

        try:
            if request.failure_injection.ai_model_fail:
                raise RuntimeError("AI model crashed")

            selected_driver, driver_scores = self._choose_with_scoring(online_drivers, request)
            llm_driver_id, llm_reason = self._llm_pick_driver(request, driver_scores, trace_id)
            if llm_driver_id and llm_driver_id in {driver.driver_id for driver in online_drivers}:
                selected_driver = next(driver for driver in online_drivers if driver.driver_id == llm_driver_id)
                decision_reason = llm_reason or f"Selected {selected_driver.driver_id} by LLM-assisted decision."
                strategy = "llm_assisted"
            else:
                decision_reason = f"Selected {selected_driver.driver_id} by weighted scoring."
                strategy = "weighted_scoring"

            status = "selected"
            log_event(
                logging.INFO,
                "dispatch_decision",
                trace_id,
                selected_driver_id=selected_driver.driver_id,
                strategy=strategy,
            )
        except Exception as error:
            selected_driver = choose_with_rule_based(online_drivers, request.objective)
            decision_reason = f"AI failed ({str(error)}). Fallback rule-based selected {selected_driver.driver_id}."
            status = "fallback_selected"
            driver_scores = []
            log_event(
                logging.ERROR,
                "dispatch_fallback",
                trace_id,
                error=str(error),
                selected_driver_id=selected_driver.driver_id,
            )

        return {
            **state,
            "status": status,
            "selected_driver_id": selected_driver.driver_id,
            "reason": decision_reason,
            "driver_scores": driver_scores,
        }

    def _llm_pick_driver(
        self,
        request: DispatchRequest,
        driver_scores: list[DriverScore],
        trace_id: str,
    ) -> tuple[str | None, str]:
        if self.llm is None:
            log_event(logging.INFO, "llm_skipped", trace_id, reason="LLM not configured.")
            return None, ""

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a taxi dispatch planner. Choose exactly one best driver id. "
                    "Return strict JSON: {{\"selected_driver_id\":\"...\",\"reason\":\"...\"}}.",
                ),
                (
                    "human",
                    "Objective: {objective}\nCandidates: {candidates}\n"
                    "Choose one driver id from the candidate list only.",
                ),
            ]
        )

        candidates = [score.model_dump() for score in driver_scores]
        message = prompt.format_messages(objective=request.objective, candidates=json.dumps(candidates))
        answer = self.llm.invoke(message)
        content = getattr(answer, "content", "") or ""
        normalized_content = self._normalize_json_content(content)

        try:
            parsed = json.loads(normalized_content)
            selected_driver_id = parsed.get("selected_driver_id")
            reason = parsed.get("reason", "Selected by LLM-assisted decision.")
            log_event(
                logging.INFO,
                "llm_decision_received",
                trace_id,
                selected_driver_id=selected_driver_id,
            )
            return selected_driver_id, reason
        except Exception:
            log_event(logging.WARNING, "llm_parse_failed", trace_id, raw=content)
            return None, ""

    def _normalize_json_content(self, content: str) -> str:
        text = content.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()
            if text.lower().startswith("json"):
                text = text[4:].strip()
        return text

    def _collect_missing_context(self, drivers: list[DriverCandidate]) -> list[str]:
        missing: set[str] = set()
        for driver in drivers:
            if driver.distance_km is None:
                missing.add("distance_km")
            if driver.rating is None:
                missing.add("rating")
        return sorted(missing)

    def _required_tools(self, objective: str) -> tuple[bool, bool]:
        if objective == "fastest":
            return True, False
        if objective == "cheapest":
            return False, True
        if objective == "best_rated":
            return False, False
        return True, True

    def _ensure_eta(
        self,
        driver: DriverCandidate,
        failure_controller: FailureController,
        tool_logs: list[ToolCallLog],
        retry_report: RetryReport,
        trace_id: str,
    ) -> None:
        if driver.eta_min is not None:
            tool_logs.append(
                ToolCallLog(
                    tool="eta",
                    driver_id=driver.driver_id,
                    attempts=0,
                    status="skipped",
                    message="ETA already provided in context.",
                )
            )
            return

        attempts = 0
        while attempts < self.max_retry:
            attempts += 1
            try:
                driver.eta_min = compute_eta(driver.distance_km or 0.0, failure_controller)
                tool_logs.append(
                    ToolCallLog(
                        tool="eta",
                        driver_id=driver.driver_id,
                        attempts=attempts,
                        status="used",
                        message="ETA computed successfully.",
                    )
                )
                if attempts > 1:
                    retry_report.eta_retries += attempts - 1
                log_event(
                    logging.INFO,
                    "tool_eta_success",
                    trace_id,
                    driver_id=driver.driver_id,
                    attempts=attempts,
                    eta_min=driver.eta_min,
                )
                return
            except ToolExecutionError as error:
                log_event(
                    logging.WARNING,
                    "tool_eta_retry",
                    trace_id,
                    driver_id=driver.driver_id,
                    attempts=attempts,
                    error=str(error),
                )

        retry_report.eta_retries += self.max_retry - 1
        driver.eta_min = round((driver.distance_km or 0.0) * 3.0, 2)
        tool_logs.append(
            ToolCallLog(
                tool="eta",
                driver_id=driver.driver_id,
                attempts=self.max_retry,
                status="fallback",
                message="ETA tool failed. Used heuristic ETA fallback.",
            )
        )
        log_event(
            logging.ERROR,
            "tool_eta_fallback",
            trace_id,
            driver_id=driver.driver_id,
            eta_min=driver.eta_min,
        )

    def _ensure_price(
        self,
        driver: DriverCandidate,
        failure_controller: FailureController,
        tool_logs: list[ToolCallLog],
        retry_report: RetryReport,
        trace_id: str,
    ) -> None:
        if driver.price_k is not None:
            tool_logs.append(
                ToolCallLog(
                    tool="pricing",
                    driver_id=driver.driver_id,
                    attempts=0,
                    status="skipped",
                    message="Pricing already provided in context.",
                )
            )
            return

        attempts = 0
        while attempts < self.max_retry:
            attempts += 1
            try:
                driver.price_k = compute_price_k(driver.distance_km or 0.0, failure_controller)
                tool_logs.append(
                    ToolCallLog(
                        tool="pricing",
                        driver_id=driver.driver_id,
                        attempts=attempts,
                        status="used",
                        message="Pricing computed successfully.",
                    )
                )
                if attempts > 1:
                    retry_report.pricing_retries += attempts - 1
                log_event(
                    logging.INFO,
                    "tool_pricing_success",
                    trace_id,
                    driver_id=driver.driver_id,
                    attempts=attempts,
                    price_k=driver.price_k,
                )
                return
            except ToolExecutionError as error:
                log_event(
                    logging.WARNING,
                    "tool_pricing_retry",
                    trace_id,
                    driver_id=driver.driver_id,
                    attempts=attempts,
                    error=str(error),
                )

        retry_report.pricing_retries += self.max_retry - 1
        driver.price_k = round(10.0 + (driver.distance_km or 0.0) * 9.0, 2)
        tool_logs.append(
            ToolCallLog(
                tool="pricing",
                driver_id=driver.driver_id,
                attempts=self.max_retry,
                status="fallback",
                message="Pricing tool failed. Used heuristic pricing fallback.",
            )
        )
        log_event(
            logging.ERROR,
            "tool_pricing_fallback",
            trace_id,
            driver_id=driver.driver_id,
            price_k=driver.price_k,
        )

    def _choose_with_scoring(
        self,
        drivers: list[DriverCandidate],
        request: DispatchRequest,
    ) -> tuple[DriverCandidate, list[DriverScore]]:
        weights = objective_weights(request.objective, request.weights)
        scores: list[tuple[DriverCandidate, float, dict[str, float]]] = []
        for driver in drivers:
            score, components = score_driver(driver, weights)
            scores.append((driver, score, components))

        scores.sort(key=lambda item: item[1], reverse=True)
        selected_driver = scores[0][0]

        driver_scores = [
            DriverScore(driver_id=driver.driver_id, score=score, components=components)
            for driver, score, components in scores
        ]
        return selected_driver, driver_scores
