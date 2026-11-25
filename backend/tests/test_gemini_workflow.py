from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.agents.provider import ReviewAnalysis
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.drafting_service import DraftingService
from conftest import authorization


@pytest.mark.parametrize("sentiment", ("positive", "neutral", "negative", "very_negative"))
@pytest.mark.parametrize("language", ("en", "ur", "hi", "ar", "de"))
def test_gemini_accepts_supported_sentiment_and_language(sentiment, language):
    result = ReviewAnalysis(sentiment=sentiment, language=language, confidence=0.87, intent="suggestion")
    assert result.sentiment == sentiment and result.language == language


@pytest.mark.parametrize("fields", (
    {"sentiment": "mixed"}, {"language": "German"}, {"intent": "refund"},
    {"confidence": -0.1}, {"confidence": 1.01},
))
def test_gemini_rejects_malformed_classification(fields):
    defaults = {"sentiment": "positive", "language": "de", "intent": "praise", "confidence": 0.87}
    with pytest.raises(ValidationError):
        ReviewAnalysis.model_validate({**defaults, **fields})


@pytest.mark.asyncio
async def test_preview_reports_field_errors_without_importing_reviews(api):
    client, users = api
    headers = authorization(users["a"])
    result = await client.post("/api/v1/reviews/import/preview", headers=headers, json={
        "csv": "rating,content\n4,Helpful service\n8,Outside the rating scale",
    })
    assert result.status_code == 200
    assert result.json()["valid"] == 1 and len(result.json()["errors"]) == 1
    assert (await client.get("/api/v1/reviews/", headers=headers)).json()["total"] == 0


@pytest.mark.asyncio
async def test_automation_settings_do_not_cross_tenants(api):
    client, users = api
    route = "/api/v1/reviews/automation"
    assert (await client.patch(route, headers=authorization(users["a"]), json={
        "enabled": True, "min_rating": 1, "max_rating": 2, "language": "de",
    })).status_code == 200
    assert (await client.get(route, headers=authorization(users["a"]))).json()["language"] == "de"
    assert (await client.get(route, headers=authorization(users["b"]))).json()["enabled"] is False
    assert (await client.patch(route, headers=authorization(users["a"]), json={
        "enabled": True, "min_rating": 4, "max_rating": 2,
    })).status_code == 422


@pytest.mark.asyncio
async def test_daily_quota_remains_at_limit_after_denied_attempt(api, monkeypatch):
    monkeypatch.setattr(settings, "AI_USER_DAILY_LIMIT", 1)
    uid = uuid4()
    scope = "user:" + str(uid)
    async with AsyncSessionLocal() as db:
        service = DraftingService(db)
        await service._take(scope, 1)
        await db.commit()
        assert await service.remaining(uid) == 0
        with pytest.raises(HTTPException) as exc:
            await service._take(scope, 1)
        assert exc.value.status_code == 429
        await db.rollback()
        assert await service.remaining(uid) == 0
