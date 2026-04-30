from dotenv import load_dotenv

load_dotenv()  # must run before routes import — routes.py creates DispatchAgent() at module level

from fastapi import FastAPI

from app.api.routes import router
from app.core.logging_config import configure_logging


configure_logging()

app = FastAPI(
    title="Cab Booking Agents",
    version="1.0.0",
    description="AI-like dispatch workflow with retry, fallback, and decision logs.",
)

app.include_router(router)
