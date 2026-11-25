# Hosted release

[Production workspace](https://autoreply-ai-workspace.vercel.app/) · [Hosted API](https://autoreply-ai-api.vercel.app/health) · [Public source](https://github.com/MoizAi8/autoreply-to-customer-agent)

Both Vercel Hobby projects deployed the same application source revision, `51373b435db10af22f815d88e6a19f690133c9fc`. The Vercel deployment metadata reports Ready for the [workspace deployment](https://vercel.com/abdul-moiz-ali-s-projects/autoreply-ai-workspace/8ceEN9StYLwwrC46Hdc3nJCVeRTA) and [API deployment](https://vercel.com/abdul-moiz-ali-s-projects/autoreply-ai-api/8zFQUTdqDksSq27TTnvbCXhsNTQx). The Vercel API reports `GEMINI_API_KEY` as Sensitive in Production. Both production aliases returned HTTP 200 after the backend redeploy.

| Gate | Evidence |
| --- | --- |
| Authentication and tenant isolation | Anonymous workspace access redirected to sign-in. The API rejected registration without an invitation, allowed invited accounts, and returned HTTP 404 for cross-tenant review and reply requests. |
| Database | The API readiness endpoint passed. A read-only Neon Free PostgreSQL check verified migration `20261125_draft_jobs` and the drafting/job budget tables. |
| Short-window rate limiting | Six invalid synthetic MFA challenges returned HTTP 401. The seventh returned HTTP 429. This limiter is scoped per API process. |
| Positive sentiment and genuine inference | Gemini 3.5 Flash-Lite drafted an English response about an early pickup. The operator edited, approved, reloaded, regenerated, and approved the new draft in the queue. |
| Neutral sentiment and multilingual correction | Gemini classified a factual parcel review as neutral. An earlier retry returned the wrong language. The final deployment sends an explicit language requirement and checks the script. A new English-language review returned a genuine Urdu draft that persisted after reload. |
| Negative sentiment and automation | A new review matched the saved rating rule. Gemini generated a German reply, the agent activity listed the completed automation job, and the draft persisted after a browser reload. |
| CSV and analytics | Chromium previewed and imported a CSV with an invalid row, verified response completion, downloaded a sentiment CSV, and navigated the signed-in dashboard on mobile. |
| AI quota | The synthetic account used its five daily attempts, including one upstream failure. PostgreSQL rejected the sixth with HTTP 429, and the generated count remained unchanged. |
| Browser console and network | The final language run recorded zero browser console errors and zero unexpected HTTP failures. The earlier provider HTTP 503 was shown to the operator and recorded as a failed job. |
| Deployment independence | Browser requests used the hosted API over HTTPS. The hosted request path uses PostgreSQL for data and draft jobs. Redis and a persistent Celery worker are outside this deployment. |

Deployment uses Vercel Hobby, Neon Free, and the Gemini API free tier, with no paid billing activation. The workspace is invitation-only. See [Known limitations](KNOWN_LIMITATIONS.md).

The release is ready for invite-only use on the free tier.
