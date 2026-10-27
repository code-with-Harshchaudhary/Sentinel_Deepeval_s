# AxiomEval

AxiomEval is a local-first AI evaluation control plane for curating datasets,
executing reproducible test runs, comparing experiments, and inspecting the
trace behind every verdict. The product wraps the repository's existing
evaluation concepts in a separately deployable React application and FastAPI
service.

The UI does not ship demo records or fabricate analytics. A new workspace opens
empty and becomes populated only through user-created datasets and executed
evaluations.

## Architecture

```text
.
├── frontend/                 React, TypeScript, Vite, Tailwind
│   ├── src/components/       Product shell and reusable UI primitives
│   ├── src/pages/            Dashboard, datasets, runs, traces, settings
│   └── src/lib/              Typed API client and domain types
├── backend/                  FastAPI and SQLAlchemy application layer
│   ├── app/api.py            Versioned REST endpoints
│   ├── app/evaluation.py     Persisted evaluation execution
│   ├── app/models.py         Database models
│   └── migrations/           Alembic schema history
├── deepeval/                 Existing Python evaluation SDK and engine
├── typescript/               Existing TypeScript evaluation SDK
├── docs/                     Existing framework documentation site
├── tests/                    Existing SDK test suite
└── docker-compose.yml        Frontend, API, PostgreSQL, and Redis
```

The new application is isolated in `frontend/` and `backend/` so the established
SDKs remain import-compatible while the product layer evolves.

## Product surfaces

- Dashboard with real evaluation history and pass-rate trends
- Dataset and test-case CRUD with validation
- Configurable deterministic metrics
- Optional structured-output LLM judge metrics for relevancy, groundedness, and task completion
- Asynchronous evaluation workflows with progress and failure states
- Per-case results, reasons, thresholds, and latency
- Two-to-four-run experiment comparison
- Recorded evaluator traces and spans
- Hashed workspace API keys whose secret is shown only once
- Environment-only provider credentials and workspace settings
- Responsive in-product documentation

## Local setup

### Requirements

- Python 3.11+
- Node.js 22+
- Corepack/Yarn

### 1. Start the backend

From the repository root in PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".\backend[dev]"
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The API is available at `http://localhost:8000`; interactive OpenAPI docs are
at `http://localhost:8000/api/docs`.

### 2. Start the frontend

In a second terminal:

```powershell
cd frontend
corepack yarn install
corepack yarn dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the backend during local
development.

### Environment configuration

Copy `backend/.env.example` to `backend/.env`. Provider secrets must stay in
the backend environment and must never use the `VITE_` prefix.

```dotenv
AXIOM_DATABASE_URL=sqlite:///./axiomeval.db
AXIOM_REDIS_URL=
AXIOM_CORS_ORIGINS=http://localhost:5173
AXIOM_JUDGE_MODEL=gpt-6-astra
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

Exact match, contains, and pattern match are fully local and require no provider
key. Answer relevancy, groundedness, and task completion use structured judge
verdicts and remain disabled until `OPENAI_API_KEY` is configured. With
`AXIOM_REDIS_URL` unset, development
runs use FastAPI's local background runner. Docker and production deployments
dispatch runs to a dedicated Redis Queue worker.

## Docker deployment

```powershell
docker compose up --build
```

The production frontend is exposed at `http://localhost:8080` and the API at
`http://localhost:8000`. PostgreSQL data and Redis state use named volumes.

Set a strong `POSTGRES_PASSWORD` before deploying outside a local machine.

## Quality checks

```powershell
# Frontend
cd frontend
corepack yarn typecheck
corepack yarn build

# Backend
cd ..
.\.venv\Scripts\python.exe -m pytest backend\tests
```

## Security model

- LLM provider credentials are read only by the backend.
- The settings API rejects values whose names imply keys or secrets.
- Workspace API keys are hashed at rest and shown once on creation.
- CORS origins are explicit and environment-configurable.
- Destructive dataset operations are blocked while recorded runs reference the dataset.

## Branding

The working identity is centralized as **AxiomEval**. Product metadata lives in
`frontend/index.html`, `frontend/src/components/app-shell.tsx`, and
`backend/app/config.py`.

## License and attribution

This repository retains the Apache License 2.0 in `LICENSE.md`. Required
third-party attribution is preserved in `THIRD_PARTY_NOTICES.md`.
