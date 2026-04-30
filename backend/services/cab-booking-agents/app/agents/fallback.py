from app.models.schemas import DriverCandidate, DispatchObjective


def choose_with_rule_based(drivers: list[DriverCandidate], objective: DispatchObjective) -> DriverCandidate:
    if objective == "cheapest":
        return min(drivers, key=lambda d: (d.price_k if d.price_k is not None else float("inf")))
    if objective == "fastest":
        return min(drivers, key=lambda d: (d.eta_min if d.eta_min is not None else float("inf")))
    if objective == "best_rated":
        return max(drivers, key=lambda d: (d.rating if d.rating is not None else 0.0))

    return min(
        drivers,
        key=lambda d: (
            (d.eta_min if d.eta_min is not None else 999.0)
            + (d.price_k if d.price_k is not None else 999.0)
            - (d.rating if d.rating is not None else 0.0)
        ),
    )
