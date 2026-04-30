from fastapi import APIRouter

from app.agents.dispatch_agent import DispatchAgent
from app.models.schemas import DispatchRequest, DispatchResponse


router = APIRouter()
agent = DispatchAgent()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/v1/agents/dispatch", response_model=DispatchResponse)
def dispatch(request: DispatchRequest) -> DispatchResponse:
    return agent.handle_dispatch(request)
