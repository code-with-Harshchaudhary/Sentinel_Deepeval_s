# Production deployment

AxiomEval deploys as a Vite SPA on Vercel, a FastAPI web service plus RQ worker on Render, a private Render Key Value instance, and PostgreSQL on Supabase.

## 1. Supabase

Create a project and copy the **Session pooler** connection string from **Connect**. Session mode works from Render's IPv4 network and suits this long-running SQLAlchemy service. Replace the password placeholder, percent-encode reserved password characters, and require TLS:

```text
postgresql://.../postgres?sslmode=require
```

Keep this URL server-side. The frontend does not need a Supabase URL, anon key, service-role key, or database password.

## 2. Render

Create a Blueprint from the repository's `render.yaml`. It provisions `axiomeval-api`, `axiomeval-worker`, and private `axiomeval-redis`. Enter these prompted secrets/settings:

| Variable | Service(s) | Value |
| --- | --- | --- |
| `DATABASE_URL` | API and worker | The same Supabase Session pooler URL |
| `AXIOM_CORS_ORIGINS` | API | Exact HTTPS Vercel/custom origins, comma-separated, with no paths |
| `OPENAI_API_KEY` | API and worker | Optional for deterministic-only use; otherwise the same provider key |

The API runs Alembic migrations before Uvicorn starts. Verify `https://<api-host>/api/health` returns `{"status":"ok",...}`. If the Blueprint name receives a suffix, use the actual Render URL below.

The backend pins the Python 3.13 release line in `backend/.python-version`; the frontend pins Node 24 in `frontend/package.json`.

## 3. Vercel

Import the repository, set **Root Directory** to `frontend`, and set this environment variable for Production (and Preview if previews need the API):

```text
VITE_API_URL=https://<api-host>/api
```

Deploy, then ensure the final Vercel production/custom origin is present in the API's `AXIOM_CORS_ORIGINS` and redeploy the API after changes. `VITE_API_URL` is intentionally public browser configuration; never put credentials in a `VITE_` variable.

## Security checklist

- Store database/provider values only in Supabase, Render, or local ignored `.env` files. Do not commit `.env.production`, private keys, or downloaded cloud credential JSON.
- Use exact HTTPS CORS origins. CORS is not authentication: this API has no user login/tenant boundary, so treat the deployed dashboard as a single trusted workspace and add an identity-aware access layer before exposing sensitive data publicly.
- Rotate a credential immediately if it has ever appeared in Git history, logs, screenshots, or a browser-side variable.
- Restrict Supabase network access where your plan and Render egress setup allow it, enable SSL enforcement, backups, and provider spend/rate limits.
