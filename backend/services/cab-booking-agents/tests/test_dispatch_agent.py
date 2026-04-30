from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.agents.dispatch_agent import DispatchAgent
from app.main import app
from app.models.schemas import DispatchRequest


def _base_payload() -> dict:
    return {
        "user_id": "u-1",
        "pickup": "A",
        "dropoff": "B",
        "objective": "balanced",
        "drivers": [
            {"driver_id": "D1", "distance_km": 5.0, "rating": 4.2, "is_online": True},
            {"driver_id": "D2", "distance_km": 2.0, "rating": 4.0, "is_online": True},
            {"driver_id": "D3", "distance_km": 3.0, "rating": 4.8, "is_online": False},
        ],
    }


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_dispatch_selects_nearest_in_balanced_simple_case() -> None:
    client = TestClient(app)
    payload = _base_payload()
    payload["drivers"] = [
        {"driver_id": "D1", "distance_km": 5.0, "rating": 4.0, "is_online": True},
        {"driver_id": "D2", "distance_km": 2.0, "rating": 4.0, "is_online": True},
    ]

    response = client.post("/v1/agents/dispatch", json=payload)
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "selected"
    assert body["selected_driver_id"] == "D2"


def test_dispatch_best_rated_can_win_over_distance() -> None:
    agent = DispatchAgent()
    request = DispatchRequest(
        user_id="u-1",
        pickup="A",
        dropoff="B",
        objective="best_rated",
        drivers=[
            {"driver_id": "D1", "distance_km": 1.0, "rating": 4.0, "is_online": True},
            {"driver_id": "D2", "distance_km": 4.0, "rating": 4.9, "is_online": True},
        ],
    )

    response = agent.handle_dispatch(request)

    assert response.status == "selected"
    assert response.selected_driver_id == "D2"
    assert all(item.status == "skipped" for item in response.tool_calls)


def test_dispatch_balances_eta_and_price() -> None:
    agent = DispatchAgent()
    request = DispatchRequest(
        user_id="u-1",
        pickup="A",
        dropoff="B",
        objective="balanced",
        drivers=[
            {
                "driver_id": "D1",
                "distance_km": 2.0,
                "rating": 4.2,
                "is_online": True,
                "eta_min": 8.0,
                "price_k": 50.0,
            },
            {
                "driver_id": "D2",
                "distance_km": 3.0,
                "rating": 4.9,
                "is_online": True,
                "eta_min": 9.0,
                "price_k": 40.0,
            },
        ],
    )

    response = agent.handle_dispatch(request)

    assert response.status == "selected"
    assert response.selected_driver_id == "D2"
    assert all(item.status == "skipped" for item in response.tool_calls)


def test_only_required_tool_is_called_for_fastest_objective() -> None:
    agent = DispatchAgent()
    request = DispatchRequest(
        user_id="u-2",
        pickup="A",
        dropoff="B",
        objective="fastest",
        drivers=[
            {"driver_id": "D1", "distance_km": 2.0, "rating": 4.2, "is_online": True},
        ],
    )

    response = agent.handle_dispatch(request)
    eta_logs = [x for x in response.tool_calls if x.tool == "eta"]
    pricing_logs = [x for x in response.tool_calls if x.tool == "pricing"]

    assert response.status == "selected"
    assert eta_logs[0].status in ["used", "skipped"]
    assert pricing_logs[0].status == "skipped"


def test_need_more_context_when_driver_fields_missing() -> None:
    agent = DispatchAgent()
    request = DispatchRequest(
        user_id="u-3",
        pickup="A",
        dropoff="B",
        objective="balanced",
        drivers=[
            {"driver_id": "D1", "distance_km": 2.0, "is_online": True},
        ],
    )

    response = agent.handle_dispatch(request)

    assert response.status == "need_more_context"
    assert "rating" in response.missing_context_fields


def test_eta_retry_then_success() -> None:
    agent = DispatchAgent()
    request = DispatchRequest(
        user_id="u-4",
        pickup="A",
        dropoff="B",
        objective="balanced",
        failure_injection={"eta_fail_attempts": 1, "pricing_fail_attempts": 0, "ai_model_fail": False},
        drivers=[
            {"driver_id": "D1", "distance_km": 2.0, "rating": 4.4, "is_online": True},
        ],
    )

    response = agent.handle_dispatch(request)

    assert response.status == "selected"
    assert response.retry_report.eta_retries == 1
    eta_log = [item for item in response.tool_calls if item.tool == "eta"][0]
    assert eta_log.status == "used"
    assert eta_log.attempts == 2


def test_eta_fallback_after_retry_exhausted() -> None:
    agent = DispatchAgent()
    request = DispatchRequest(
        user_id="u-5",
        pickup="A",
        dropoff="B",
        objective="balanced",
        failure_injection={"eta_fail_attempts": 3, "pricing_fail_attempts": 0, "ai_model_fail": False},
        drivers=[
            {"driver_id": "D1", "distance_km": 4.0, "rating": 4.4, "is_online": True},
        ],
    )

    response = agent.handle_dispatch(request)

    assert response.status == "selected"
    assert response.retry_report.eta_retries == 2
    eta_log = [item for item in response.tool_calls if item.tool == "eta"][0]
    assert eta_log.status == "fallback"


def test_offline_drivers_are_filtered_and_can_return_no_driver_available() -> None:
    agent = DispatchAgent()
    request = DispatchRequest(
        user_id="u-6",
        pickup="A",
        dropoff="B",
        objective="balanced",
        drivers=[
            {"driver_id": "D1", "distance_km": 3.0, "rating": 4.2, "is_online": False},
        ],
    )

    response = agent.handle_dispatch(request)

    assert response.status == "no_driver_available"
    assert response.selected_driver_id is None
    assert response.filtered_offline_drivers == ["D1"]


def test_ai_failure_uses_rule_based_fallback() -> None:
    agent = DispatchAgent()
    request = DispatchRequest(
        user_id="u-7",
        pickup="A",
        dropoff="B",
        objective="balanced",
        failure_injection={"eta_fail_attempts": 0, "pricing_fail_attempts": 0, "ai_model_fail": True},
        drivers=[
            {"driver_id": "D1", "distance_km": 2.0, "rating": 4.2, "is_online": True},
            {"driver_id": "D2", "distance_km": 3.0, "rating": 4.9, "is_online": True},
        ],
    )

    response = agent.handle_dispatch(request)

    assert response.status == "fallback_selected"
    assert response.selected_driver_id is not None
    assert "AI failed" in response.reason


def test_dispatch_logs_include_trace_id_and_decision(caplog) -> None:
    agent = DispatchAgent()
    request = DispatchRequest(
        user_id="u-8",
        pickup="A",
        dropoff="B",
        objective="balanced",
        trace_id="trace-test-001",
        drivers=[
            {"driver_id": "D1", "distance_km": 2.0, "rating": 4.2, "is_online": True},
        ],
    )

    with caplog.at_level("INFO"):
        response = agent.handle_dispatch(request)

    assert response.trace_id == "trace-test-001"
    logs = "\n".join(record.message for record in caplog.records)
    assert "dispatch_started" in logs
    assert "dispatch_decision" in logs
    assert "trace-test-001" in logs


def test_parallel_requests_are_stable() -> None:
    agent = DispatchAgent()

    def run_once(idx: int) -> str:
        req = DispatchRequest(
            user_id=f"u-{idx}",
            pickup="A",
            dropoff="B",
            objective="balanced",
            drivers=[
                {"driver_id": "D1", "distance_km": 4.0, "rating": 4.2, "is_online": True},
                {"driver_id": "D2", "distance_km": 2.0, "rating": 4.2, "is_online": True},
            ],
        )
        res = agent.handle_dispatch(req)
        return res.selected_driver_id or ""

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(run_once, range(20)))

    assert all(driver_id == "D2" for driver_id in results)