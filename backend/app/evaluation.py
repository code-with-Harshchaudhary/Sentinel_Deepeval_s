from __future__ import annotations

import re
import time
from datetime import datetime, timezone

from pydantic import BaseModel, Field
from sqlalchemy import select

from .config import get_settings
from .database import SessionLocal
from .models import EvaluationResult, EvaluationRun, MetricDefinition, TestCase, Trace


class JudgeVerdict(BaseModel):
    score: float = Field(ge=0, le=1)
    reason: str


JUDGE_CRITERIA = {
    "answer_relevancy": "Score how directly and helpfully the actual output answers the input. Penalize tangents and missing requested information.",
    "groundedness": "Score whether every factual claim in the actual output is supported by the supplied context. Penalize unsupported or contradictory claims.",
    "task_completion": "Score whether the actual output fully completes the user's requested task. Penalize omissions, invented completion, and unusable output.",
}


def _score(metric_key: str, case: TestCase) -> tuple[float, str]:
    actual = case.actual_output.strip()
    expected = case.expected_output.strip()
    if metric_key == "exact_match":
        passed = actual == expected
        return (
            1.0 if passed else 0.0,
            "Actual and expected outputs match exactly."
            if passed
            else "Actual and expected outputs differ.",
        )
    if metric_key == "pattern_match":
        if not expected:
            return 0.0, "Expected output must contain a regular expression."
        try:
            passed = re.fullmatch(expected, actual) is not None
        except re.error as exc:
            return 0.0, f"Expected output is not a valid regular expression: {exc}"
        return (
            1.0 if passed else 0.0,
            "Actual output matches the expected pattern."
            if passed
            else "Actual output does not match the expected pattern.",
        )
    if metric_key == "contains":
        passed = bool(expected) and expected.casefold() in actual.casefold()
        return (
            1.0 if passed else 0.0,
            "Actual output contains the expected text."
            if passed
            else "Actual output does not contain the expected text.",
        )
    raise ValueError(f"Unsupported metric: {metric_key}")


def _judge(metric_key: str, case: TestCase, model: str) -> tuple[float, str]:
    if metric_key not in JUDGE_CRITERIA:
        raise ValueError(f"Unsupported judge metric: {metric_key}")
    context = case.retrieval_context or case.context
    if metric_key == "groundedness" and not context:
        raise ValueError("Groundedness requires context or retrieval context on every test case.")

    from openai import OpenAI

    response = OpenAI().responses.parse(
        model=model,
        store=False,
        input=[
            {
                "role": "system",
                "content": (
                    "You are a strict AI evaluation judge. Return a calibrated score from 0 to 1 "
                    "and a concise evidence-based reason. Do not rewrite the answer. "
                    + JUDGE_CRITERIA[metric_key]
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Input:\n{case.input}\n\nActual output:\n{case.actual_output}\n\n"
                    f"Expected output (may be empty):\n{case.expected_output}\n\n"
                    f"Context (may be empty):\n{context}"
                ),
            },
        ],
        text_format=JudgeVerdict,
    )
    verdict = response.output_parsed
    if verdict is None:
        raise ValueError("The judge model did not return a scoreable verdict.")
    return verdict.score, verdict.reason


def execute_run(run_id: int) -> None:
    started = time.perf_counter()
    with SessionLocal() as db:
        run = db.get(EvaluationRun, run_id)
        if run is None:
            return
        run.status = "running"
        run.progress = 0
        db.commit()
        try:
            cases = list(
                db.scalars(
                    select(TestCase)
                    .where(TestCase.dataset_id == run.dataset_id)
                    .order_by(TestCase.id)
                )
            )
            metrics = {
                metric.key: metric
                for metric in db.scalars(
                    select(MetricDefinition).where(
                        MetricDefinition.key.in_(run.metric_keys),
                        MetricDefinition.enabled.is_(True),
                    )
                )
            }
            if not cases:
                raise ValueError("The selected dataset has no test cases.")
            missing = set(run.metric_keys) - set(metrics)
            if missing:
                raise ValueError(f"Unknown or disabled metrics: {', '.join(sorted(missing))}")

            total = len(cases) * len(metrics)
            settings = get_settings()
            judge_model = settings.judge_model if run.model in {"deterministic", "provider-default"} else run.model
            completed = 0
            scores: list[float] = []
            for case in cases:
                trace_started = time.perf_counter()
                spans: list[dict] = []
                case_passed = True
                for key, metric in metrics.items():
                    metric_started = time.perf_counter()
                    score, reason = (
                        _judge(key, case, judge_model)
                        if metric.requires_model
                        else _score(key, case)
                    )
                    latency_ms = (time.perf_counter() - metric_started) * 1000
                    passed = score >= metric.threshold
                    case_passed = case_passed and passed
                    scores.append(score)
                    db.add(
                        EvaluationResult(
                            run_id=run.id,
                            test_case_id=case.id,
                            metric_key=key,
                            score=score,
                            threshold=metric.threshold,
                            passed=passed,
                            reason=reason,
                            latency_ms=latency_ms,
                        )
                    )
                    spans.append(
                        {
                            "name": metric.name,
                            "type": "evaluator",
                            "status": "passed" if passed else "failed",
                            "duration_ms": round(latency_ms, 3),
                            "score": score,
                            "threshold": metric.threshold,
                        }
                    )
                    completed += 1
                    run.progress = completed / total
                db.add(
                    Trace(
                        run_id=run.id,
                        test_case_id=case.id,
                        name=case.name,
                        status="passed" if case_passed else "failed",
                        duration_ms=(time.perf_counter() - trace_started) * 1000,
                        spans=spans,
                    )
                )
                if case_passed:
                    run.passed += 1
                else:
                    run.failed += 1
                db.commit()

            run.average_score = sum(scores) / len(scores)
            run.duration_ms = (time.perf_counter() - started) * 1000
            run.progress = 1
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            db.commit()
        except Exception as exc:
            run.status = "failed"
            run.error = str(exc)
            run.duration_ms = (time.perf_counter() - started) * 1000
            run.completed_at = datetime.now(timezone.utc)
            db.commit()
