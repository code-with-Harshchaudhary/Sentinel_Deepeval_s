from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .database import get_db
from .evaluation import execute_run
from .models import (
    ApiKey,
    AppSetting,
    Dataset,
    EvaluationResult,
    EvaluationRun,
    MetricDefinition,
    TestCase,
    Trace,
)
from .schemas import (
    ApiKeyCreate,
    ApiKeyCreated,
    ApiKeyRead,
    DatasetCreate,
    DatasetRead,
    DatasetUpdate,
    MetricRead,
    MetricUpdate,
    RunCreate,
    RunRead,
    SettingsUpdate,
    TestCaseCreate,
    TestCaseRead,
    TraceRead,
)

router = APIRouter()


def _dataset_or_404(db: Session, dataset_id: int) -> Dataset:
    dataset = db.scalar(
        select(Dataset)
        .where(Dataset.id == dataset_id)
        .options(selectinload(Dataset.cases))
    )
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sentinel_deepeval-api"}


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)) -> dict[str, Any]:
    dataset_count = db.scalar(select(func.count()).select_from(Dataset)) or 0
    case_count = db.scalar(select(func.count()).select_from(TestCase)) or 0
    run_count = db.scalar(select(func.count()).select_from(EvaluationRun)) or 0
    completed = list(
        db.scalars(
            select(EvaluationRun)
            .where(EvaluationRun.status == "completed")
            .order_by(EvaluationRun.created_at.desc())
            .limit(30)
        )
    )
    recent = list(
        db.scalars(
            select(EvaluationRun)
            .options(selectinload(EvaluationRun.results).selectinload(EvaluationResult.test_case))
            .order_by(EvaluationRun.created_at.desc())
            .limit(6)
        )
    )
    passed = sum(run.passed for run in completed)
    failed = sum(run.failed for run in completed)
    trend = [
        {
            "id": run.id,
            "label": run.name,
            "date": run.created_at.isoformat(),
            "score": run.average_score,
            "pass_rate": run.passed / max(run.passed + run.failed, 1),
        }
        for run in reversed(completed[:12])
    ]
    return {
        "stats": {
            "datasets": dataset_count,
            "test_cases": case_count,
            "runs": run_count,
            "pass_rate": passed / max(passed + failed, 1),
        },
        "trend": trend,
        "recent_runs": [RunRead.model_validate(run) for run in recent],
    }


@router.get("/datasets", response_model=list[DatasetRead])
def list_datasets(db: Session = Depends(get_db)) -> list[Dataset]:
    return list(
        db.scalars(
            select(Dataset)
            .options(selectinload(Dataset.cases))
            .order_by(Dataset.updated_at.desc())
        )
    )


@router.post("/datasets", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
def create_dataset(payload: DatasetCreate, db: Session = Depends(get_db)) -> Dataset:
    dataset = Dataset(**payload.model_dump())
    db.add(dataset)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A dataset with this name already exists") from exc
    db.refresh(dataset)
    return _dataset_or_404(db, dataset.id)


@router.get("/datasets/{dataset_id}", response_model=DatasetRead)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)) -> Dataset:
    return _dataset_or_404(db, dataset_id)


@router.patch("/datasets/{dataset_id}", response_model=DatasetRead)
def update_dataset(
    dataset_id: int, payload: DatasetUpdate, db: Session = Depends(get_db)
) -> Dataset:
    dataset = _dataset_or_404(db, dataset_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(dataset, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A dataset with this name already exists") from exc
    return _dataset_or_404(db, dataset_id)


@router.delete("/datasets/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)) -> None:
    dataset = _dataset_or_404(db, dataset_id)
    if db.scalar(
        select(func.count()).select_from(EvaluationRun).where(EvaluationRun.dataset_id == dataset_id)
    ):
        raise HTTPException(
            status_code=409,
            detail="Delete this dataset's evaluation runs before deleting the dataset.",
        )
    db.delete(dataset)
    db.commit()


@router.post(
    "/datasets/{dataset_id}/cases",
    response_model=TestCaseRead,
    status_code=status.HTTP_201_CREATED,
)
def create_case(
    dataset_id: int, payload: TestCaseCreate, db: Session = Depends(get_db)
) -> TestCase:
    _dataset_or_404(db, dataset_id)
    case = TestCase(dataset_id=dataset_id, **payload.model_dump())
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


@router.patch("/datasets/{dataset_id}/cases/{case_id}", response_model=TestCaseRead)
def update_case(
    dataset_id: int,
    case_id: int,
    payload: TestCaseCreate,
    db: Session = Depends(get_db),
) -> TestCase:
    case = db.scalar(
        select(TestCase).where(TestCase.id == case_id, TestCase.dataset_id == dataset_id)
    )
    if case is None:
        raise HTTPException(status_code=404, detail="Test case not found")
    for key, value in payload.model_dump().items():
        setattr(case, key, value)
    db.commit()
    db.refresh(case)
    return case


@router.delete("/datasets/{dataset_id}/cases/{case_id}", status_code=204)
def delete_case(dataset_id: int, case_id: int, db: Session = Depends(get_db)) -> None:
    case = db.scalar(
        select(TestCase).where(TestCase.id == case_id, TestCase.dataset_id == dataset_id)
    )
    if case is None:
        raise HTTPException(status_code=404, detail="Test case not found")
    db.delete(case)
    db.commit()


@router.get("/metrics", response_model=list[MetricRead])
def list_metrics(db: Session = Depends(get_db)) -> list[MetricDefinition]:
    return list(db.scalars(select(MetricDefinition).order_by(MetricDefinition.name)))


@router.patch("/metrics/{metric_key}", response_model=MetricRead)
def update_metric(
    metric_key: str, payload: MetricUpdate, db: Session = Depends(get_db)
) -> MetricDefinition:
    metric = db.scalar(select(MetricDefinition).where(MetricDefinition.key == metric_key))
    if metric is None:
        raise HTTPException(status_code=404, detail="Metric not found")
    if payload.enabled and metric.requires_model and not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=422,
            detail="Set OPENAI_API_KEY in the backend environment before enabling this judge metric.",
        )
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(metric, key, value)
    db.commit()
    db.refresh(metric)
    return metric


@router.get("/runs", response_model=list[RunRead])
def list_runs(
    run_status: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[EvaluationRun]:
    query = select(EvaluationRun).options(
        selectinload(EvaluationRun.results).selectinload(EvaluationResult.test_case)
    )
    if run_status:
        query = query.where(EvaluationRun.status == run_status)
    return list(db.scalars(query.order_by(EvaluationRun.created_at.desc())))


@router.get("/runs/compare")
def compare_runs(ids: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    run_ids = [int(item) for item in ids.split(",") if item.strip().isdigit()]
    if len(run_ids) < 2 or len(run_ids) > 4:
        raise HTTPException(status_code=422, detail="Choose between two and four runs")
    runs = list(
        db.scalars(
            select(EvaluationRun)
            .where(EvaluationRun.id.in_(run_ids))
            .options(selectinload(EvaluationRun.results))
        )
    )
    if len(runs) != len(set(run_ids)):
        raise HTTPException(status_code=404, detail="One or more runs were not found")
    metric_keys = sorted({result.metric_key for run in runs for result in run.results})
    return {
        "metrics": metric_keys,
        "runs": [
            {
                "id": run.id,
                "name": run.name,
                "average_score": run.average_score,
                "pass_rate": run.passed / max(run.passed + run.failed, 1),
                "metric_scores": {
                    key: (
                        sum(result.score for result in run.results if result.metric_key == key)
                        / max(sum(1 for result in run.results if result.metric_key == key), 1)
                    )
                    for key in metric_keys
                },
            }
            for run in runs
        ],
    }


@router.post("/runs", response_model=RunRead, status_code=status.HTTP_202_ACCEPTED)
def create_run(
    payload: RunCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> EvaluationRun:
    dataset = _dataset_or_404(db, payload.dataset_id)
    if not dataset.cases:
        raise HTTPException(status_code=422, detail="Add at least one test case before running an evaluation")
    run = EvaluationRun(**payload.model_dump())
    db.add(run)
    db.commit()
    db.refresh(run)
    settings = get_settings()
    if settings.redis_url:
        try:
            from redis import Redis
            from rq import Queue

            connection = Redis.from_url(settings.redis_url)
            connection.ping()
            Queue("evaluations", connection=connection).enqueue(
                execute_run,
                run.id,
                job_timeout="30m",
                result_ttl=86400,
            )
        except Exception as exc:
            run.status = "failed"
            run.error = "Evaluation queue is unavailable."
            db.commit()
            raise HTTPException(
                status_code=503,
                detail="The evaluation queue is unavailable. Try again shortly.",
            ) from exc
    else:
        background_tasks.add_task(execute_run, run.id)
    return run


@router.get("/runs/{run_id}", response_model=RunRead)
def get_run(run_id: int, db: Session = Depends(get_db)) -> EvaluationRun:
    run = db.scalar(
        select(EvaluationRun)
        .where(EvaluationRun.id == run_id)
        .options(selectinload(EvaluationRun.results).selectinload(EvaluationResult.test_case))
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.delete("/runs/{run_id}", status_code=204)
def delete_run(run_id: int, db: Session = Depends(get_db)) -> None:
    run = db.get(EvaluationRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    db.delete(run)
    db.commit()


@router.get("/traces", response_model=list[TraceRead])
def list_traces(
    run_id: int | None = None, db: Session = Depends(get_db)
) -> list[Trace]:
    query = select(Trace)
    if run_id is not None:
        query = query.where(Trace.run_id == run_id)
    return list(db.scalars(query.order_by(Trace.created_at.desc()).limit(250)))


@router.get("/traces/{trace_id}", response_model=TraceRead)
def get_trace(trace_id: int, db: Session = Depends(get_db)) -> Trace:
    trace = db.get(Trace, trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace


@router.get("/api-keys", response_model=list[ApiKeyRead])
def list_api_keys(db: Session = Depends(get_db)) -> list[ApiKey]:
    return list(db.scalars(select(ApiKey).order_by(ApiKey.created_at.desc())))


@router.post("/api-keys", response_model=ApiKeyCreated, status_code=201)
def create_api_key(payload: ApiKeyCreate, db: Session = Depends(get_db)) -> ApiKeyCreated:
    raw_secret = f"axm_{secrets.token_urlsafe(32)}"
    key = ApiKey(
        name=payload.name,
        prefix=raw_secret[:12],
        secret_hash=hashlib.sha256(raw_secret.encode()).hexdigest(),
    )
    db.add(key)
    db.commit()
    db.refresh(key)
    return ApiKeyCreated.model_validate(key).model_copy(update={"secret": raw_secret})


@router.delete("/api-keys/{key_id}", status_code=204)
def delete_api_key(key_id: int, db: Session = Depends(get_db)) -> None:
    key = db.get(ApiKey, key_id)
    if key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    db.delete(key)
    db.commit()


@router.get("/settings")
def get_app_settings(db: Session = Depends(get_db)) -> dict[str, Any]:
    values = {row.key: row.value for row in db.scalars(select(AppSetting))}
    return {
        "values": values,
        "providers": {
            "openai": bool(os.getenv("OPENAI_API_KEY")),
            "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
            "gemini": bool(os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")),
        },
    }


@router.put("/settings")
def update_app_settings(
    payload: SettingsUpdate, db: Session = Depends(get_db)
) -> dict[str, Any]:
    forbidden = {key for key in payload.values if "key" in key.lower() or "secret" in key.lower()}
    if forbidden:
        raise HTTPException(
            status_code=422,
            detail="Provider secrets must be configured through server environment variables.",
        )
    for key, value in payload.values.items():
        setting = db.get(AppSetting, key)
        if setting is None:
            db.add(AppSetting(key=key, value=value))
        else:
            setting.value = value
            setting.updated_at = datetime.now(timezone.utc)
    db.commit()
    return get_app_settings(db)


@router.get("/search")
def global_search(
    q: str = Query(min_length=2, max_length=100), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    term = f"%{q}%"
    datasets = db.scalars(
        select(Dataset).where(or_(Dataset.name.ilike(term), Dataset.description.ilike(term))).limit(6)
    )
    runs = db.scalars(select(EvaluationRun).where(EvaluationRun.name.ilike(term)).limit(6))
    metrics = db.scalars(
        select(MetricDefinition)
        .where(or_(MetricDefinition.name.ilike(term), MetricDefinition.description.ilike(term)))
        .limit(6)
    )
    return [
        *({"type": "dataset", "id": item.id, "title": item.name, "href": f"/datasets/{item.id}"} for item in datasets),
        *({"type": "run", "id": item.id, "title": item.name, "href": f"/runs/{item.id}"} for item in runs),
        *({"type": "metric", "id": item.id, "title": item.name, "href": "/metrics"} for item in metrics),
    ]
