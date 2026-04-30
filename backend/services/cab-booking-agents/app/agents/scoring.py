from app.models.schemas import DriverCandidate, DispatchObjective, ObjectiveWeights


def objective_weights(objective: DispatchObjective, default_weights: ObjectiveWeights) -> ObjectiveWeights:
    if objective == "fastest":
        return ObjectiveWeights(eta=0.7, price=0.1, rating=0.1, distance=0.1)
    if objective == "cheapest":
        return ObjectiveWeights(eta=0.1, price=0.7, rating=0.1, distance=0.1)
    if objective == "best_rated":
        return ObjectiveWeights(eta=0.1, price=0.1, rating=0.7, distance=0.1)
    return default_weights


def score_driver(driver: DriverCandidate, weights: ObjectiveWeights) -> tuple[float, dict[str, float]]:
    eta_component = -(driver.eta_min if driver.eta_min is not None else 999.0)
    price_component = -(driver.price_k if driver.price_k is not None else 999.0)
    rating_component = driver.rating if driver.rating is not None else 0.0
    distance_component = -(driver.distance_km if driver.distance_km is not None else 999.0)

    total = (
        weights.eta * eta_component
        + weights.price * price_component
        + weights.rating * rating_component
        + weights.distance * distance_component
    )
    return round(total, 6), {
        "eta": round(weights.eta * eta_component, 6),
        "price": round(weights.price * price_component, 6),
        "rating": round(weights.rating * rating_component, 6),
        "distance": round(weights.distance * distance_component, 6),
    }
