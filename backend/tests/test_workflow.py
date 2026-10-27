from fastapi.testclient import TestClient

from app.main import app


def test_dataset_to_trace_workflow() -> None:
    with TestClient(app) as client:
        judge_metric = client.patch(
            "/api/metrics/answer_relevancy", json={"enabled": True}
        )
        assert judge_metric.status_code == 422

        dataset = client.post(
            "/api/datasets",
            json={"name": "Release gate", "description": "", "tags": ["smoke"]},
        )
        assert dataset.status_code == 201
        dataset_id = dataset.json()["id"]

        case = client.post(
            f"/api/datasets/{dataset_id}/cases",
            json={
                "name": "Greeting",
                "input": "Say hello",
                "actual_output": "Hello",
                "expected_output": "Hello",
                "context": [],
                "retrieval_context": [],
                "metadata_json": {},
            },
        )
        assert case.status_code == 201

        run = client.post(
            "/api/runs",
            json={
                "dataset_id": dataset_id,
                "name": "Release candidate",
                "metric_keys": ["exact_match"],
                "model": "deterministic",
            },
        )
        assert run.status_code == 202

        detail = client.get(f"/api/runs/{run.json()['id']}")
        assert detail.json()["status"] == "completed"
        assert detail.json()["average_score"] == 1.0
        assert client.get("/api/traces").json()[0]["status"] == "passed"
