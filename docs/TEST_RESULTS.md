# Release verification

| Check | Result |
| --- | --- |
| Live Gemini sentiment and multilingual output | PASS. Real Gemini 3.5 Flash-Lite inference classified a fictional German complaint and drafted a German response. |
| Live local workflow persistence | PASS. The classified review, draft, completed job, and approval were persisted. |
| Public frontend and private workspace | Chromium covered responsive landing, the workflow illustration, access gating, CSV preview and import, global search, persisted replies, analytics, and business settings. |
| Database migrations | PASS. SQLite and hosted Neon PostgreSQL applied the draft job and quota migration. |
| Hosted application and AI | BLOCKED. The Production Gemini credential is pending. |
| Redis worker and external platform connectors | NOT TESTED in the hosted environment. |

Run `python -m pytest --cov=app -p no:cacheprovider` from `backend/`. For browser QA, start an isolated API with local signups enabled, drafting disabled, and the frontend origin in CORS. Build and serve the static frontend, then run `npm test` with `QA_API_URL` and `QA_WEB_URL` targeting those services. Install Playwright Chromium or set `QA_CHROMIUM` to the installed binary.

[Verification screenshots](PORTFOLIO.md) · [Hosted release](HOSTED_RELEASE.md)
