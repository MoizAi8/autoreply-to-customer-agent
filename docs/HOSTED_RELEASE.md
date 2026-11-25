# Hosted release

The dedicated Vercel API project is linked to a Neon Free PostgreSQL database. The database migration ran against Neon. The release candidate includes a separate workspace frontend with the production API URL.

| Gate | Status |
| --- | --- |
| Local Gemini API inference | PASS. Gemini 3.5 Flash-Lite classified positive, neutral, and negative fictional feedback and returned English, Urdu, and German replies. |
| Local draft persistence and human approval | PASS. The reply, classified sentiment, job, and approval persisted. |
| Hosted Gemini credential | BLOCKED. The operator needs to add `GEMINI_API_KEY` as Sensitive for Production. |
| Final workspace deployment and hosted AI verification | Pending hosted credential configuration. |

Once the operator confirms the credential, deploy the backend and linked prebuilt frontend to Production, verify the API's database readiness and frontend CORS, and exercise invite registration with a fictional review. Verify live generation, approval, persistence after reload and workspace isolation against the deployed app.

[Backend project environment settings](https://vercel.com/abdul-moiz-ali-s-projects/autoreply-ai-api/settings/environment-variables)
