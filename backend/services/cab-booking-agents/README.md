# Cab Booking Agents (FastAPI)

This folder contains a Python FastAPI service that models the AI agent workflow for driver dispatch with detailed logs.

Workflow engine is implemented with LangGraph state graph.

## Folder Structure

```text
cab-booking-agents/
  app/
    api/
      routes.py
    agents/
      dispatch_agent.py
      fallback.py
      scoring.py
      tools.py
    core/
      logging_config.py
    models/
      schemas.py
    main.py
  requirements.txt
```

## Run

```bash
cd services/cab-booking-agents
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

## Optional LLM Config (LangGraph Node)

By default, dispatch decision runs deterministic weighted scoring inside LangGraph.

Set environment variables if you want LangGraph to call an LLM node:

```bash
ENABLE_LLM_DECISION=true
LLM_PROVIDER=google
GOOGLE_API_KEY=<your_google_ai_studio_key>
GOOGLE_MODEL=gemini-2.5-flash
```

For OpenAI provider:

```bash
ENABLE_LLM_DECISION=true
LLM_PROVIDER=openai
OPENAI_API_KEY=<your_key>
OPENAI_MODEL=gpt-4o-mini
```

If these are not set, service still works normally without external model calls.

## Run Tests

```bash
cd services/cab-booking-agents
pip install -r requirements.txt -r requirements-dev.txt
pytest -q
```

## API

- `GET /health`: health check.
- `POST /v1/agents/dispatch`: run dispatch agent.

## Example Request

```json
{
  "user_id": "u1",
  "pickup": "A",
  "dropoff": "B",
  "objective": "balanced",
  "failure_injection": {
    "eta_fail_attempts": 1,
    "pricing_fail_attempts": 0,
    "ai_model_fail": false
  },
  "drivers": [
    {"driver_id": "D1", "distance_km": 5, "rating": 4.2, "is_online": true},
    {"driver_id": "D2", "distance_km": 2, "rating": 4.0, "is_online": true},
    {"driver_id": "D3", "distance_km": 3, "rating": 4.8, "is_online": false}
  ]
}
```

## Logging Behavior

Each run emits JSON logs to stdout with `trace_id`, event name, retry info, and final decision reason.

## How This Maps To Your Testcases

- Nearest driver among many available: scoring includes distance and ETA.
- Higher rating can win over shorter distance: weighted multi-objective scoring.
- Balance ETA vs price: objective `balanced` uses both ETA and pricing.
- Correct tool calling: only required tools are called; redundant calls are skipped.
- Missing context: returns `need_more_context` with missing fields.
- Retry on service failure: ETA/Pricing calls retry up to 3 attempts before fallback heuristic.
- Offline drivers: filtered out before assignment.
- Full decision logs and trace id: response includes tool logs, scores, retry report.
- Parallel requests safety: no shared mutable decision state across requests.
- AI fail fallback: if `ai_model_fail=true`, fallback rule-based selection keeps system running.
