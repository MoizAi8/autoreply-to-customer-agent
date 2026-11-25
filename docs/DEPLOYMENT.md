# Deployment

## Local and Compose

See the root README for environment setup. Compose serves the Next.js static build with NGINX and keeps PostgreSQL, Redis and the API on local infrastructure. PostgreSQL migrations must run before serving traffic. Use `/health` for liveness and `/ready` for database readiness.

## Vercel and Neon

- Backend project `autoreply-ai-api` uses FastAPI and the configuration in `backend/vercel.json`. Run `alembic upgrade head` against the intended Neon PostgreSQL database before deploying.
- Store `SECRET_KEY`, `REGISTRATION_INVITE`, `DATABASE_URL` and `GEMINI_API_KEY` on the backend. Configure credentials as Sensitive in Production where Vercel allows it. Set the exact frontend origin in `CORS_ORIGINS` and `APP_URL`.
- Set `AI_GENERATION_ENABLED=true`, `AI_PROVIDER=gemini` and `ALLOW_SIGNUPS=false`. The model defaults to `gemini-3.5-flash-lite`. Defaults allow five attempts per user and 30 across the service per UTC day, with two active jobs. Check the provider’s quota before changing these controls.
- Build the workspace with the deployed API URL including `/api/v1`, `NEXT_PUBLIC_INVITE_SIGNUPS=true` and `NEXT_PUBLIC_ALLOW_SIGNUPS=false`. These public flags are applied at build time.
- The hosted drafting path processes requests with a database-backed job ledger. The legacy Celery/Redis workers require a separate runtime and credentials.

Use a fictional review to verify intake, model inference, approval, and persistence after reload. Confirm unauthorized requests are rejected and the workspace origin can reach the API.

[Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing?frmapp=yes) · [Vercel environment settings](https://vercel.com/abdul-moiz-ali-s-projects/autoreply-ai-api/settings/environment-variables)
