# Known limitations

- The public landing page links to an invitation-only workspace. Drafting uses the Gemini free tier with separate provider and application quotas. The API can temporarily return an error during provider outages or quota exhaustion. Manual response editing remains available.
- Short-window authentication and request rate limits run per API process. Draft budgets and concurrency checks are shared through PostgreSQL. The hosted request path records drafting jobs in PostgreSQL and has no Redis broker or persistent Celery worker.
- Automatic drafting handles matching manual intake. CSV import stores reviews for later drafting. Approval changes the internal status, and users can copy approved responses for external posting. Platform ingestion integrations and direct publishing are outside the verified release.
- Reviews preserve their imported text. The response studio supports draft editing, regeneration, and version history. It has no version-restore action.
- Reviews awaiting analysis are unclassified. Advanced topic mining is unavailable. Local reset email and custom SMTP delivery need an independently configured provider and end-to-end verification.
- Browser sessions use browser storage. Refresh-token rotation with theft detection, a distributed short-window rate limiter, and configurable audit retention are outside the verified release.
