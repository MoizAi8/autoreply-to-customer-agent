# Engineering audit

Baseline commit `b15dcc6fe64d543d3d3252dc265b6087e9e02b52` in `C:\Auto-reply Agent`. The upstream contained a Next.js frontend, FastAPI service, SQLAlchemy models, Alembic, Celery, Redis, NGINX and deployment artifacts. The baseline static build succeeded. Its deployment configuration and generated bundle remained independent of actual database or worker health.

| Severity | Confirmed finding | Resolution or disposition |
| --- | --- | --- |
| Critical | Review webhook admitted requests when its shared secret was missing, and intake invoked drafting automatically. | Require the secret and an active target, validate requests and persist intake independently of drafting. |
| High | Authentication minted email verification and reset links as access tokens. SMTP logged fallback messages containing token links. | Enforce separate JWT token purposes, version reset links against the stored password and use configured TLS SMTP without exposing tokens in logs. |
| High | Admin service-health route lacked the superuser guard and made outbound provider requests. | Require a superuser session. |
| High | AI failures returned hardcoded responses with model metadata. Pipeline metadata stored objects that JSON persistence could not serialize. | Require validated provider output and persist bounded stage summaries. |
| High | Regeneration called an incompatible service signature. Publish could return success after adapter failure or through a simulated adapter. | Wire regeneration to the existing reply and disable publishing through unverified adapters. |
| High | The only migration attempted to alter a missing table. Compose readiness pointed at a nonexistent endpoint. The frontend container expected a different Next.js artifact. | Add an initial schema, review identity migration, readiness endpoint and static frontend container. |
| High | Baseline package audits identified vulnerable dependencies. | Upgrade supported runtime packages and rerun dependency scans. |
| Medium | Dashboard and owner-facing pages presented random trends, hardcoded complaints, billing records and nonexistent connections. | Render stored counts, approved drafts, real workflow events and explicit empty states. |
| Medium | Status sorting and filtering, response data, and malformed date errors did not match the frontend contract. | Add typed responses and explicit filters with stable sort order and validation. |
| Medium | Business settings displayed success while discarding multiple fields. | Persist business and brand fields and supply the saved preferences when drafting. |
| Medium | Platform external IDs had no tenant-scoped database constraint. | Apply a partial unique index. Existing duplicate identifiers require review before migration. |
| Medium | Auth input labels were visually present without an accessible association. | Add stable input IDs and link labels and error text. |
| Low | Static export included a middleware rule that relied on cookies while auth used browser storage. | Protect workspace rendering via the authenticated profile request, with authorization enforced by the API. |

See [Security](SECURITY_AUDIT.md), [QA](TEST_RESULTS.md), and [Known limitations](KNOWN_LIMITATIONS.md) for verification scope.
