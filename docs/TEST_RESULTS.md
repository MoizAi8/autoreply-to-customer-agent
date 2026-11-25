# Release verification

Tested on 25 November 2026. Automated scenarios exercise validation, tenant-scoped API flows, database reads and writes, auth token purposes, protected admin routes, mocked AI success and outages, and the actual browser workflow. The database fixtures and screenshot accounts contain synthetic information.

| Check | Result |
| --- | --- |
| Python regression suite | 120 passed. Approximately 48% line coverage across the entire backend, including untested platform adapters and workers. |
| Chromium end-to-end suite | 7 passed across desktop, tablet and mobile. Includes anonymous route gating, the static sample, review entry and CSV import, status persistence, analytics and business-profile saving. |
| Production frontend | Static Next.js build and TypeScript checks passed. ESLint passed with two warnings from sign-up form observation and hard navigation after authentication failure. |
| Database schema | Clean upgrades and Alembic checks passed on SQLite and PostgreSQL 17.10. PostgreSQL migration SQL also compiled offline. |
| Dependency advisories | Final full npm audit and Python installed package audit each reported zero known advisories. |
| License and history scan | Original GitHub repository is public and MIT licensed. Gitleaks flagged one masked sample key in historical mock admin data. |
| Live AI provider | Blocked by missing authorized OpenAI credentials. Mocked AI tests make zero external calls. |
| PostgreSQL integration | An isolated cluster passed concurrent review deduplication, cross-tenant isolation, draft locking, approval persistence and analytics aggregation. |
| Celery task | Eager execution against PostgreSQL returned the same approved reply on two deliveries. No Redis broker or persistent-worker integration run. |
| Hosted demo | Seven checks passed. Chromium verified HTTPS, assets, sample draft editing and approval, zero backend requests and no browser errors at widths of 1440, 820 and 390 pixels. Four excluded login, dashboard and API paths returned 404. |
| Hosted backend and hosted AI | No backend deployed. |

## Acceptance gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Project recovery | PASS | Verified baseline and recoverable Git bundle. |
| Frontend quality | PASS | Core local workspace pages rebuilt and reviewed in Chromium. |
| Core review management | PASS | Local intake, filters, draft editing, approval and reload persistence verified. |
| Genuine AI response generation | BLOCKED | An authorized OpenAI key was unavailable. |
| Agent workflow reliability | BLOCKED | Mocked success, retry and failure passed. Live provider behavior remains unverified. |
| Database persistence | PASS | SQLite and isolated PostgreSQL verified. |
| Backend reliability | PASS | Local API and database regression checks passed. |
| Worker reliability | NOT TESTED | Eager task check passed. Broker delivery and long-running operation need Redis-backed QA. |
| Authentication | PASS | Local token purposes, sign-in, MFA challenge, and ownership checks passed. |
| Security | PASS | Scoped local regression checks and package scans passed. Hosted API security needs separate verification. |
| Responsive design | PASS | Verified at desktop, tablet, and mobile widths in Chromium. |
| Automated testing | PASS | 120 backend tests and seven browser scenarios. |
| Production build | PASS | Static export and type checks passed. |
| Personal GitHub publication | BLOCKED | The target was verified. Full source release is gated on live provider validation and worker QA. |
| Hosted frontend | PASS | Restricted static sample on Vercel Hobby. |
| Hosted backend | BLOCKED | An authorized backend hosting environment and database were unavailable. |
| Hosted AI functionality | BLOCKED | Hosted backend and provider credentials were unavailable. |
| Public demonstration safety | PASS | Fictional data, no backend requests, and private routes returned 404. |

## Reproduce

Run `python -m pytest --cov=app -p no:cacheprovider` from `backend/` after installing `requirements-dev.txt`. Use a fresh isolated browser database and run Alembic before starting Uvicorn. For browser QA, point `NEXT_PUBLIC_API_URL` and `QA_API_URL` to that backend. Enable local registration, set the exact frontend CORS origin, and leave AI disabled. From `frontend/`, build with `npm run build`, serve the export on port 3011, and run `npm test`. Use `npx playwright install chromium` or supply an installed Chromium binary through `QA_CHROMIUM`.

See the [screenshots](PORTFOLIO.md) and the [performance measurements](PERFORMANCE_REPORT.md).
