# Security audit

- Tenant-scoped review, reply, brand and analytics access is enforced in the API. Automated checks exercise foreign-tenant read and write decisions and administrator authorization using isolated data.
- Anonymous registration and live AI are mutually exclusive configuration choices. The draft endpoints share a rate limit. Provider calls are bounded and use backend credentials. Review text and reviewer-supplied fields are treated as untrusted data.
- The API bounds request bodies even when streamed. CSV parsing bounds input size, row count, accepted headers and each field. The current flow displays imported text and does not export spreadsheets.
- The webhook uses a deployment secret, rejects absent or invalid credentials, and does not invoke AI.
- JWT purposes are checked. Password reset links cannot be reused after a successful password change. The frontend retains browser storage for session tokens. Verification and reset emails require SMTP configuration.
- The original Git history scan flagged one masked sample key from the old admin UI. The current admin page contains no sample keys. The local checkpoint bundle and test environment remain ignored by Git.
- Final Python and full npm audits reported zero known advisories. Provider, platform, and hosted backend security remain subject to deployed verification.

The static sample workspace has no private data, login, backend endpoint, stored session, or provider credentials in its public release artifact. Changes are held in page memory.
