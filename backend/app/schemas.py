from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TestCaseCreate(BaseModel):
    name: str = Field(default="Untitled case", min_length=1, max_length=160)
    input: str = Field(min_length=1)
    actual_output: str = ""
    expected_output: str = ""
    context: list[str] = Field(default_factory=list)
    retrieval_context: list[str] = Field(default_factory=list)
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class TestCaseRead(ORMModel, TestCaseCreate):
    id: int
    dataset_id: int
    created_at: datetime
    updated_at: datetime


class DatasetCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    tags: list[str] = Field(default_factory=list)


class DatasetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    tags: list[str] | None = None


class DatasetRead(ORMModel):
    id: int
    name: str
    description: str
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    cases: list[TestCaseRead] = Field(default_factory=list)


class MetricUpdate(BaseModel):
    threshold: float | None = Field(default=None, ge=0, le=1)
    enabled: bool | None = None


class MetricRead(ORMModel):
    id: int
    key: str
    name: str
    category: str
    description: str
    threshold: float
    enabled: bool
    requires_model: bool


class RunCreate(BaseModel):
    dataset_id: int
    name: str = Field(min_length=2, max_length=160)
    metric_keys: list[str] = Field(min_length=1)
    model: str = Field(default="deterministic", max_length=120)


class ResultRead(ORMModel):
    id: int
    test_case_id: int
    metric_key: str
    score: float
    threshold: float
    passed: bool
    reason: str
    latency_ms: float
    test_case: TestCaseRead


class TraceRead(ORMModel):
    id: int
    run_id: int
    test_case_id: int
    name: str
    status: str
    duration_ms: float
    spans: list[dict[str, Any]]
    created_at: datetime


class RunRead(ORMModel):
    id: int
    dataset_id: int
    name: str
    status: str
    progress: float
    model: str
    metric_keys: list[str]
    passed: int
    failed: int
    average_score: float | None
    duration_ms: float | None
    error: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    results: list[ResultRead] = Field(default_factory=list)


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class ApiKeyRead(ORMModel):
    id: int
    name: str
    prefix: str
    last_used_at: datetime | None
    created_at: datetime


class ApiKeyCreated(ApiKeyRead):
    secret: str


class SettingsUpdate(BaseModel):
    values: dict[str, Any]
