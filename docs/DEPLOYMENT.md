# Deployment

## Local Compose and verification

Use PostgreSQL 16, Redis 7, Python 3.12 and Node.js 24. Create the root and backend environment files from the examples. Set a strong Compose PostgreSQL password, using URL-safe characters for the Compose connection string. Compose builds Next.js as static assets and serves them with NGINX. PostgreSQL, Redis, the API and the frontend bind to loopback for local use. The optional `edge` profile requires business-owned TLS certificates in `docker/ssl`.

The API startup command executes `alembic upgrade head` before serving. `/health` is liveness. `/ready` checks access to the review table. Back up existing databases before running the migration. The review identity migration stops if existing rows have conflicting external review identifiers.

## Public static portfolio demo

The published demo is [AutoReply AI on Vercel](https://autoreply-review-demo.vercel.app). Build the frontend with `NEXT_PUBLIC_PORTFOLIO_DEMO=true`, `NEXT_PUBLIC_ALLOW_SIGNUPS=false`, and `NEXT_PUBLIC_API_URL=/api/v1`. From `frontend/`, run `node scripts/package-demo.mjs <new-staging-directory>`, link the staging directory to the Vercel project, and deploy it with `vercel deploy --prebuilt --prod`. The package serves the landing page, sample workspace, and Next.js static assets. [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)

## Private application hosting

A Render Free web service can host the request-based FastAPI application. Its free services can sleep and the free tier excludes always-running background workers. Use the free web blueprint only for an isolated preview. [Render Free limits](https://render.com/docs/free)

Neon can provide a persistent PostgreSQL database. Set the server-side database URL with TLS and run migrations before app traffic. Keep the frontend origin explicit. If a worker is independently authorized, provision a Redis-compatible broker and verify delivery, retry policy and connectivity with the exact Redis plan. The Redis free tier is bounded by usage and does not provide a worker runtime. [Neon plans](https://neon.com/docs/introduction/plans) · [Upstash Redis pricing](https://upstash.com/pricing/redis)

For hosted live AI, provision accounts before enabling drafting and verify quotas on the deployment’s supplied key. The frontend should use `NEXT_PUBLIC_API_URL` with the deployed API’s HTTPS origin. Setup requires a verified database, backend owner and provider credentials.
