from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .api import router
from .config import get_settings
from .database import Base, SessionLocal, engine
from .models import MetricDefinition


DEFAULT_METRICS = [
    {
        "key": "exact_match",
        "name": "Exact match",
        "category": "Deterministic",
        "description": "Passes only when actual and expected output are identical after trimming whitespace.",
        "threshold": 1.0,
        "requires_model": False,
    },
    {
        "key": "contains",
        "name": "Contains expected text",
        "category": "Deterministic",
        "description": "Checks whether the actual output contains the expected text, ignoring case.",
        "threshold": 1.0,
        "requires_model": False,
    },
    {
        "key": "pattern_match",
        "name": "Pattern match",
        "category": "Deterministic",
        "description": "Treats the expected output as a regular expression and checks the complete response.",
        "threshold": 1.0,
        "requires_model": False,
    },
    {
        "key": "answer_relevancy",
        "name": "Answer relevancy",
        "category": "LLM judge",
        "description": "Uses a structured model verdict to score whether the response directly addresses the input.",
        "threshold": 0.7,
        "enabled": False,
        "requires_model": True,
    },
    {
        "key": "groundedness",
        "name": "Groundedness",
        "category": "RAG",
        "description": "Scores whether response claims are supported by the supplied context or retrieval context.",
        "threshold": 0.7,
        "enabled": False,
        "requires_model": True,
    },
    {
        "key": "task_completion",
        "name": "Task completion",
        "category": "LLM judge",
        "description": "Scores whether the response completes the requested task without inventing unsupported work.",
        "threshold": 0.7,
        "enabled": False,
        "requires_model": True,
    },
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        existing = set(db.scalars(select(MetricDefinition.key)))
        for definition in DEFAULT_METRICS:
            if definition["key"] not in existing:
                db.add(MetricDefinition(**definition))
        db.commit()
    yield


settings = get_settings()
app = FastAPI(
    title=f"{settings.app_name} API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix=settings.api_prefix)
