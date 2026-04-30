from threading import Lock


class ToolExecutionError(Exception):
    pass


class FailureController:
    def __init__(self, eta_fail_attempts: int, pricing_fail_attempts: int) -> None:
        self._eta_remaining = eta_fail_attempts
        self._pricing_remaining = pricing_fail_attempts
        self._lock = Lock()

    def should_fail(self, tool_name: str) -> bool:
        with self._lock:
            if tool_name == "eta" and self._eta_remaining > 0:
                self._eta_remaining -= 1
                return True
            if tool_name == "pricing" and self._pricing_remaining > 0:
                self._pricing_remaining -= 1
                return True
        return False


def compute_eta(distance_km: float, failure_controller: FailureController) -> float:
    if failure_controller.should_fail("eta"):
        raise ToolExecutionError("ETA service temporary failure")
    return round(2.0 + (distance_km * 2.1), 2)


def compute_price_k(distance_km: float, failure_controller: FailureController) -> float:
    if failure_controller.should_fail("pricing"):
        raise ToolExecutionError("Pricing service temporary failure")
    return round(12.0 + (distance_km * 7.8), 2)
