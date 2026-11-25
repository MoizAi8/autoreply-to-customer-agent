# Known limitations

- Live OpenAI output requires an authorized API key. Automated provider scenarios use mocks. Production quota, output quality and provider uptime need a live test.
- PostgreSQL migration, locking and database operations passed on an isolated 17.10 cluster. A Redis-backed persistent Celery worker still needs deployment QA. The eager task check succeeded.
- The Google Business Profile adapter is a stub. Other platform adapters have no live verification. Manual and CSV import and copying approved responses cover the supported portfolio workflow.
- Review history records actions. The editor retains one current draft and has no version-restore interface.
- Sentiment is available after an AI workflow has run. Manual entries without classification remain unclassified. Topic mining is not included.
- Tokens are stored in browser storage. Refresh-token rotation with theft detection, distributed rate limits and persistent audit retention policies are future production work.
- SMTP, external DNS and email delivery require operating credentials and end-to-end checks. MFA sign-in is supported for configured accounts through the authenticator challenge.
