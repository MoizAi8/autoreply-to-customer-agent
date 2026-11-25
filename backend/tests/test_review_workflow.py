from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from openai import APIConnectionError
from pydantic import ValidationError

from app.agents.input_validation_agent import InputValidationAgent
from app.agents.orchestrator import AIOrchestrator
from app.agents.reply_generation_agent import GeneratedDraft
from app.core.config import settings
from app.schemas.review import GenerateReplyRequest, ManualReviewRequest
from conftest import authorization

REVIEWS = "/api/v1/reviews"
REPLIES = "/api/v1/replies"
ENTRY = {"customer_name": "Synthetic Reviewer", "rating": 4, "content": "Delivery was quick and the desk arrived safely."}


async def make_review(client, user, **fields):
    response = await client.post(REVIEWS + "/", json={**ENTRY, **fields}, headers=authorization(user))
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize("field,value", [
    ("rating", 0), ("rating", 6), ("rating", 2.5), ("rating", "bad"),
    ("customer_name", "   "), ("customer_name", "a" * 256), ("title", "a" * 501),
    ("content", ""), ("content", "  "), ("content", "ok"), ("content", "a" * 4001),
    ("review_date", "yesterday"),
])
def test_manual_review_validation(field, value):
    with pytest.raises(ValidationError):
        ManualReviewRequest.model_validate({**ENTRY, field: value})


@pytest.mark.parametrize("tone", ["professional", "friendly", "formal", "empathetic", "concise"])
@pytest.mark.parametrize("length", ["short", "medium", "long"])
def test_drafting_preferences(tone, length):
    instructions = GenerateReplyRequest(tone=tone, length=length).instructions()
    assert f"Response tone: {tone}." in instructions
    assert f"Response length: {length}." in instructions


@pytest.mark.parametrize("raw", ['{}', '{"reply":""}', '{"reply":"  "}', '{"reply":5}', 'null', 'no JSON', '{"reply":"' + "x" * 4001 + '"}'])
def test_invalid_provider_payloads_rejected(raw):
    with pytest.raises(ValidationError):
        GeneratedDraft.model_validate_json(raw)


@pytest.mark.parametrize("text,valid", [
    ("   ", False), ("Yo", False), ("https://example.com", False),
    ("Quick and convenient.", True), ("The store helped me.", True), ("Mixed experience overall.", True),
])
async def test_review_validation_agent(text, valid):
    result = await InputValidationAgent().validate({"content": text, "rating": 3})
    assert result.is_valid is valid


@pytest.mark.parametrize("method,path", [
    ("GET", REVIEWS + "/"), ("GET", REVIEWS + "/workflow"), ("POST", REVIEWS + "/"),
    ("POST", REVIEWS + "/import"), ("GET", "/api/v1/analytics/dashboard"),
    ("GET", "/api/v1/brand/"), ("GET", "/api/v1/admin/health"), ("GET", REPLIES + "/"),
])
async def test_workspace_routes_require_token(api, method, path):
    client, _ = api
    denied = await client.request(method, path)
    assert denied.status_code == 401
    assert denied.headers.get("www-authenticate") == "Bearer"


async def test_manual_review_is_persisted_without_ai(api):
    client, users = api
    review = await make_review(client, users["a"])
    assert review["review_text"] == ENTRY["content"]
    assert review["reply"] is None
    assert review["is_processed"] is False
    assert review["created_at"].endswith("Z")
    assert "customer_email" not in review
    history = await client.get(f"{REVIEWS}/{review['id']}/history", headers=authorization(users["a"]))
    assert [event["action"] for event in history.json()] == ["review_added"]
    assert history.json()[0]["created_at"].endswith("+00:00")


async def test_duplicate_scoped_to_workspace(api):
    client, users = api
    first = await make_review(client, users["a"])
    duplicate = await client.post(REVIEWS + "/", json=ENTRY, headers=authorization(users["a"]))
    assert duplicate.status_code == 409
    second = await make_review(client, users["b"])
    assert first["id"] != second["id"]


@pytest.mark.parametrize("method,suffix,body", [
    ("GET", "", None), ("GET", "/history", None), ("PATCH", "/flag", {"reason": "Needs attention"}),
    ("DELETE", "", None), ("POST", "/generate-reply", {}), ("PUT", "/draft", {"content": "Wrong tenant"}),
])
async def test_review_ownership(api, method, suffix, body):
    client, users = api
    review = await make_review(client, users["a"])
    response = await client.request(method, f"{REVIEWS}/{review['id']}{suffix}", json=body, headers=authorization(users["b"]))
    assert response.status_code == 404, response.text


@pytest.mark.parametrize("method,suffix,body", [
    ("GET", "", None), ("PATCH", "", {"content": "Wrong tenant"}), ("POST", "/approve", None),
    ("POST", "/reject", {"reason": "Wrong tenant"}), ("POST", "/regenerate", {}), ("DELETE", "", None),
])
async def test_reply_ownership(api, method, suffix, body):
    client, users = api
    review = await make_review(client, users["a"])
    draft = await client.put(f"{REVIEWS}/{review['id']}/draft", json={"content": "Thank you for the feedback."}, headers=authorization(users["a"]))
    assert draft.status_code == 200, draft.text
    response = await client.request(method, f"{REPLIES}/{draft.json()['id']}{suffix}", json=body, headers=authorization(users["b"]))
    assert response.status_code == 404, response.text


@pytest.mark.parametrize("filter_,value,count", [
    ("search", "synthetic", 2), ("search", "100%", 1), ("search", "%", 1),
    ("search", "_", 0), ("search", "unknown", 0), ("rating", "4", 1),
    ("rating", "2", 1), ("date_from", "2025-01-02", 1), ("date_to", "2025-01-02", 2),
    ("response_status", "unanswered", 2), ("response_status", "approved", 0),
])
async def test_review_filters(api, filter_, value, count):
    client, users = api
    await make_review(client, users["a"], review_date="2025-01-01")
    await make_review(client, users["a"], rating=2, content="I waited 100% longer than expected.", review_date="2025-01-02T18:30:00Z")
    response = await client.get(REVIEWS + "/", params={filter_: value}, headers=authorization(users["a"]))
    assert response.status_code == 200, response.text
    assert response.json()["total"] == count


@pytest.mark.parametrize("params,expected", [
    ({"date_to": "invalid"}, 400), ({"date_from": "2025-01-02", "date_to": "2025-01-01"}, 400),
    ({"rating": 6}, 422), ({"page": 0}, 422), ({"page_size": 101}, 422), ({"sort_by": "unknown"}, 422),
    ({"sort_order": "unknown"}, 422), ({"response_status": "unknown"}, 422),
])
async def test_invalid_filters(api, params, expected):
    client, users = api
    response = await client.get(REVIEWS + "/", params=params, headers=authorization(users["a"]))
    assert response.status_code == expected


async def test_pagination_and_rating_sort(api):
    client, users = api
    for rating in (4, 1, 5):
        await make_review(client, users["a"], rating=rating)
    headers = authorization(users["a"])
    first = await client.get(REVIEWS + "/", params={"page_size": 2, "sort_by": "rating", "sort_order": "asc"}, headers=headers)
    second = await client.get(REVIEWS + "/", params={"page_size": 2, "page": 2, "sort_by": "rating", "sort_order": "asc"}, headers=headers)
    assert [row["rating"] for row in first.json()["items"]] == [1, 4]
    assert [row["rating"] for row in second.json()["items"]] == [5]
    assert first.json()["total_pages"] == 2


@pytest.mark.parametrize("text", [
    "rating,content", "unexpected,content\n5,Good service", "rating,rating,content\n5,5,Good service",
    'rating,content\n5,"Unclosed field', "rating,content\n" + "5,Good service\n" * 201,
])
async def test_rejected_csv_makes_no_writes(api, text):
    client, users = api
    headers = authorization(users["a"])
    response = await client.post(REVIEWS + "/import", json={"csv": text}, headers=headers)
    assert response.status_code == 400
    assert (await client.get(REVIEWS + "/", headers=headers)).json()["total"] == 0


async def test_csv_import_validates_rows_and_handles_duplicates(api):
    client, users = api
    headers = authorization(users["a"])
    payload = {"csv": '\ufeffrating,content\n5,"Great service, thanks!"\n9,Invalid rating\n3,Missing,extra\n5,"Great service, thanks!"'}
    result = await client.post(REVIEWS + "/import", json=payload, headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["imported"] == 1
    assert result.json()["duplicates"] == 1
    assert [error["row"] for error in result.json()["errors"]] == [3, 4]


async def test_reserved_approval_state_and_history(api):
    client, users = api
    user = users["a"]
    headers = authorization(user)
    review = await make_review(client, user)
    review_path = f"{REVIEWS}/{review['id']}"
    draft = await client.put(review_path + "/draft", json={"content": "Thanks for your thoughtful feedback."}, headers=headers)
    assert draft.status_code == 200, draft.text
    assert draft.json()["is_ai_generated"] is False
    reply_path = f"{REPLIES}/{draft.json()['id']}"
    assert (await client.post(reply_path + "/publish", headers=headers)).status_code == 409
    assert (await client.post(reply_path + "/approve", headers=headers)).status_code == 200
    assert (await client.post(reply_path + "/approve", headers=headers)).status_code == 200
    assert (await client.post(reply_path + "/reject", json={"reason": "Too vague"}, headers=headers)).status_code == 409
    assert (await client.put(review_path + "/draft", json={"content": "Thank you for mentioning our delivery."}, headers=headers)).status_code == 200
    assert (await client.get(review_path, headers=headers)).json()["reply"]["status"] == "pending_approval"
    assert (await client.post(reply_path + "/reject", json={"reason": "Too vague"}, headers=headers)).status_code == 200
    result = (await client.get(review_path + "/history", headers=headers)).json()
    assert [event["action"] for event in result] == ["reply_rejected", "draft_updated", "reply_approved", "draft_created", "review_added"]


async def test_dashboard_uses_database_counts(api):
    client, users = api
    headers = authorization(users["a"])
    review = await make_review(client, users["a"])
    await make_review(client, users["a"], rating=2)
    await make_review(client, users["b"], rating=5)
    draft = await client.put(f"{REVIEWS}/{review['id']}/draft", json={"content": "Thank you for your feedback."}, headers=headers)
    await client.post(f"{REPLIES}/{draft.json()['id']}/approve", headers=headers)
    result = await client.get("/api/v1/analytics/dashboard", headers=headers)
    assert result.status_code == 200, result.text
    data = result.json()
    assert (data["total_reviews"], data["pending_replies"], data["approved_replies"], data["avg_rating"]) == (2, 1, 1, 3)
    assert data["ratings"] == {"2": 1, "4": 1}
    assert data["completion_rate"] == 50
    activity = await client.get("/api/v1/analytics/monthly-activity?months=3", headers=headers)
    assert activity.status_code == 200, activity.text
    assert len({item["month"] for item in activity.json()}) == 3
    assert activity.json()[-1]["reviews"] == 2


@pytest.mark.parametrize("secret,header,expected", [(None, None, 403), ("qa-secret", "", 403), ("qa-secret", "wrong", 403), ("qa-secret", "qa-secret", 200)])
async def test_webhook_requires_configured_secret(api, monkeypatch, secret, header, expected):
    client, users = api
    monkeypatch.setattr(settings, "WEBHOOK_SECRET", secret)
    response = await client.post(REVIEWS + "/webhook/google", json={**ENTRY, "business_id": str(users["a"].business_id), "platform_review_id": "sample-id"}, headers={"X-Webhook-Secret": header} if header is not None else {})
    assert response.status_code == expected, response.text


async def test_disabled_ai_leaves_review_available_for_manual_draft(api):
    client, users = api
    headers = authorization(users["a"])
    review = await make_review(client, users["a"])
    path = f"{REVIEWS}/{review['id']}"
    unavailable = await client.post(path + "/generate-reply", headers=headers)
    assert unavailable.status_code == 503
    assert (await client.get(path, headers=headers)).json()["reply"] is None
    assert (await client.put(path + "/draft", json={"content": "Reviewed manually."}, headers=headers)).status_code == 200


def enable_mock_provider(monkeypatch):
    monkeypatch.setattr(settings, "AI_GENERATION_ENABLED", True)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "synthetic-mock-key")
    original_init = AIOrchestrator.__init__
    mocks = {}

    def init(self, db):
        original_init(self, db)
        stages = [
            (self.language_detector, "detect", SimpleNamespace(language_code="en")),
            (self.intent_detector, "detect", SimpleNamespace(intent="praise", confidence=.95, sub_intent="delivery", urgency="low")),
            (self.sentiment_analyzer, "analyze", SimpleNamespace(sentiment="positive", confidence=.95, reasoning="")),
            (self.risk_classifier, "classify", SimpleNamespace(risk_level="low", risk_factors=[], needs_human_review=False)),
            (self.knowledge_retriever, "retrieve", SimpleNamespace(brand_context="Known delivery preferences", relevant_docs=[])),
            (self.safety_guardrail, "check", SimpleNamespace(is_safe=True, safety_score=95, violations=[])),
            (self.quality_evaluator, "evaluate", SimpleNamespace(overall_score=97, breakdown={}, passes_threshold=True)),
        ]
        for agent, method, result in stages:
            setattr(agent, method, AsyncMock(return_value=result))
        mock = mocks.setdefault("generation", AsyncMock(return_value=SimpleNamespace(
            reply_text="Thank you for mentioning the quick delivery.", raw_response={"model": "mock-model", "usage": {"prompt_tokens": 18}},
        )))
        self.reply_generator.generate = mock
    monkeypatch.setattr(AIOrchestrator, "__init__", init)
    return mocks


async def test_mocked_ai_success_is_idempotent_and_requires_approval(api, monkeypatch):
    client, users = api
    mocks = enable_mock_provider(monkeypatch)
    headers = authorization(users["a"])
    review = await make_review(client, users["a"])
    path = f"{REVIEWS}/{review['id']}"
    one = await client.post(path + "/generate-reply", json={"tone": "friendly", "length": "short"}, headers=headers)
    two = await client.post(path + "/generate-reply", headers=headers)
    assert one.status_code == two.status_code == 200, one.text
    assert one.json() == two.json()
    assert mocks["generation"].await_count == 1
    assert "friendly" in mocks["generation"].await_args.args[-2]
    detail = (await client.get(path, headers=headers)).json()
    assert detail["reply"]["status"] == "pending_approval"
    assert detail["reply"]["is_ai_generated"] is True
    assert detail["sentiment"] == "positive"
    assert detail["is_processed"] is True
    regenerated = await client.post(f"{REPLIES}/{detail['reply']['id']}/regenerate", json={"tone": "formal"}, headers=headers)
    assert regenerated.status_code == 200, regenerated.text
    assert mocks["generation"].await_count == 2
    assert "formal" in mocks["generation"].await_args.args[-2]


@pytest.mark.parametrize("failure", ["outage", "invalid_output"])
async def test_mocked_provider_failure_does_not_persist_false_draft(api, monkeypatch, failure):
    client, users = api
    mocks = enable_mock_provider(monkeypatch)
    original = AIOrchestrator.__init__

    def init(self, db):
        original(self, db)
        self.reply_generator.generate.side_effect = (
            APIConnectionError(request=httpx.Request("POST", "https://example.invalid"))
            if failure == "outage" else ValueError("Invalid model output")
        )

    monkeypatch.setattr(AIOrchestrator, "__init__", init)
    review = await make_review(client, users["a"])
    path = f"{REVIEWS}/{review['id']}"
    response = await client.post(path + "/generate-reply", headers=authorization(users["a"]))
    assert response.status_code == 503, response.text
    assert mocks["generation"].await_count == (2 if failure == "outage" else 1)
    assert (await client.get(path, headers=authorization(users["a"]))).json()["reply"] is None
