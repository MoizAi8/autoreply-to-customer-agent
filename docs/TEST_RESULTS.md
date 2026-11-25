# Release verification

| Check | Result |
| --- | --- |
| Live Gemini sentiment and multilingual output | PASS. Real Gemini 3.5 Flash-Lite inference classified positive, neutral, and negative feedback and drafted replies in English, Urdu, and German. |
| Live local workflow persistence | PASS. The classified review, draft, completed job, and approval were persisted. |
| Automated backend checks | 149 passed after the hosted language fix, including a regression that rejects English output for an explicit Urdu request. |
| Public frontend and private workspace | 10 Chromium scenarios cover a six-size responsive landing check, workflow illustration, access gating, CSV preview and import, global search, persisted replies, analytics, and business settings. |
| Database migrations | PASS. SQLite and hosted Neon PostgreSQL applied the draft job and quota migration. |
| Hosted application and AI | Production Chromium verified database-backed intake, editing, regeneration, approval, automation, mobile navigation, reports, and live English, German, and Urdu drafts. See the [hosted release results](HOSTED_RELEASE.md). |
| Redis worker and external platform connectors | Outside this deployment. The hosted drafting path runs in FastAPI and persists jobs to PostgreSQL. |

Run `python -m pytest --cov=app -p no:cacheprovider` from `backend/`. For browser QA, start an isolated API with local signups enabled, drafting disabled, and the frontend origin in CORS. Build and serve the static frontend, then run `npm test` with `QA_API_URL` and `QA_WEB_URL` targeting those services. Install Playwright Chromium or set `QA_CHROMIUM` to the installed binary.

[Verification screenshots](PORTFOLIO.md) · [Hosted release](HOSTED_RELEASE.md)
