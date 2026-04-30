from dataclasses import dataclass
import os


def _env_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(slots=True)
class AgentSettings:
    enable_llm_decision: bool
    llm_provider: str
    openai_api_key: str
    openai_model: str
    google_api_key: str
    google_model: str


def load_settings() -> AgentSettings:
    return AgentSettings(
        enable_llm_decision=_env_bool(os.getenv("ENABLE_LLM_DECISION"), default=False),
        llm_provider=os.getenv("LLM_PROVIDER", "openai").strip().lower(),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        google_api_key=os.getenv("GOOGLE_API_KEY", ""),
        google_model=os.getenv("GOOGLE_MODEL", "gemini-2.5-flash"),
    )
