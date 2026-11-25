import os

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.update(
    SECRET_KEY="isolated-unit-and-api-tests-only-000000000000000000",
    DATABASE_URL="sqlite+aiosqlite:///:memory:",
    OPENAI_API_KEY="",
    AI_PROVIDER="openai",
    GEMINI_API_KEY="",
    AI_GENERATION_ENABLED="false",
    ALLOW_SIGNUPS="true",
    WEBHOOK_SECRET="",
    SMTP_HOST="",
    REDIS_URL="",
    DEBUG="false",
)

from app.core.database import Base, engine, AsyncSessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.business import Business
from app.models.user import User

PASSWORD = "synthetic-test-passphrase"
PASSWORD_HASH = hash_password(PASSWORD)


@pytest.fixture
async def api():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    app.state.limiter.reset()
    async with AsyncSessionLocal() as db:
        for letter in ("a", "b"):
            business = Business(name=f"QA business {letter}", slug=f"qa-{letter}")
            db.add(business)
            await db.flush()
            db.add(User(email=f"{letter}@example.com", full_name=f"Synthetic {letter}",
                        business_id=business.id, hashed_password=PASSWORD_HASH))
        await db.commit()
        from sqlalchemy import select
        users = {user.email[0]: user for user in (await db.scalars(select(User))).all()}
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://qa.local", follow_redirects=True) as client:
        yield client, users
    await engine.dispose()


def authorization(user):
    return {"Authorization": "Bearer " + create_access_token({"sub": str(user.id)})}
