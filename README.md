# AutoReply AI

AutoReply AI is an authenticated review operations workspace. Collect feedback, generate a response in your business’s voice with Google Gemini, and review the reply before sharing it with a customer.

![AutoReply AI landing page](docs/screenshots/landing.png)

- Import individual reviews or preview a CSV before importing. Search reviews and saved responses across your workspace.
- Use Gemini Flash-Lite to classify sentiment and intent, then draft grounded, multilingual replies.
- Edit drafts, review prior versions, approve or reject replies, and copy approved text.
- Configure an opt-in draft rule for manual intake. Review processing activity and remaining draft allowance.
- Track database-backed ratings, sentiment and reply completion in the dashboard.

[Architecture](docs/ARCHITECTURE.md) · [Deployment](docs/DEPLOYMENT.md) · [Test evidence](docs/TEST_RESULTS.md) · [Screenshots](docs/PORTFOLIO.md) · [Hosted release](docs/HOSTED_RELEASE.md)

## Run locally

Use Python 3.12, Node.js 24, and PostgreSQL. SQLite is available with development dependencies for isolated QA.

1. Copy `backend/.env.example` to `backend/.env` and set the database URL and a random JWT `SECRET_KEY`.
2. For live drafting, put `GEMINI_API_KEY=` followed by your key in `backend.env` at the repository root. That file is ignored by Git. Set `AI_GENERATION_ENABLED=true`, keep `ALLOW_SIGNUPS=false` and set a generated `REGISTRATION_INVITE` in the backend environment.
3. Install `backend/requirements-dev.txt`, then run `alembic upgrade head` and `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` from `backend/`.
4. Copy `frontend/.env.example` to `frontend/.env.local`. Set `NEXT_PUBLIC_API_URL` to the local API, set `NEXT_PUBLIC_INVITE_SIGNUPS=true` for invited registration, then run `npm ci` and `npm run dev` from `frontend/`.

The default model is `gemini-3.5-flash-lite`. The operator controls the Gemini project and its provider quota. Application draft limits reset at midnight UTC. Use fictional review text for external provider verification.

## Import a CSV

Upload a UTF-8 CSV of at most 200 reviews and 256 KB. The required columns are `rating` and `content`. Optional columns include `customer_name`, `title`, `platform` and `review_date` in ISO 8601 format.

```csv
rating,content,customer_name,review_date
5,"Helpful staff, quick checkout.",Sample Reviewer,2026-11-25
```

Review intake supports manual entry and CSV. Approval is recorded in the workspace and approved replies can be copied for manual posting. External platform connectors require their own credentials and verification.

This project builds on the original MIT-licensed AutoReply AI repository and its contributors. [Upstream repository](https://github.com/moldrivo/Autoreply-to-customer-agent) · [License](LICENSE)
