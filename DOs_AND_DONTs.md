# Project guardrails

- Keep database, JWT, SMTP and AI provider credentials on the server. Use placeholders in example files.
- Resolve business ownership from the authenticated user before reading or changing reviews and responses.
- Use actual query results in dashboards and label fictional data in the sample workspace.
- Keep review intake independent of provider calls and route generated drafts to human approval.
- Validate structured model output and report provider failure without creating template drafts.
- Preserve external IDs and error states during synchronization. Show a published state only after confirmed publication.
- Use isolated data in QA and preserve the MIT license and contributor attribution when redistributing.
