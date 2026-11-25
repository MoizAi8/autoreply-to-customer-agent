import pytest
import pyotp
from fastapi import HTTPException

from app.core.config import Settings, settings
from app.core.security import create_access_token, create_refresh_token, hash_password, verify_password, verify_token
from conftest import PASSWORD, authorization

AUTH = "/api/v1/auth"


@pytest.mark.parametrize("purpose", ["access", "email_verify", "password_reset", "mfa"])
def test_token_purposes_are_preserved(purpose):
    encoded = create_access_token({"sub": "subject"}, token_type=purpose)
    assert verify_token(encoded, purpose)["sub"] == "subject"
    if purpose != "access":
        with pytest.raises(HTTPException) as error:
            verify_token(encoded, "access")
        assert error.value.status_code == 401


@pytest.mark.parametrize("url,prefix", [
    ("postgres://server/database", "postgresql+asyncpg://server"),
    ("postgresql://server/database", "postgresql+asyncpg://server"),
    ("sqlite+aiosqlite:///:memory:", "sqlite+aiosqlite:"),
    ("postgresql://server/database?sslmode=require", "postgresql+asyncpg://server/database?ssl=require"),
])
def test_database_url_normalization(url, prefix):
    assert Settings.ensure_async_driver(url).startswith(prefix)


@pytest.mark.parametrize("password", ["a" * 73, "é" * 37, "🔐" * 19])
def test_bcrypt_rejects_truncated_new_passwords(password):
    with pytest.raises(ValueError, match="72 UTF-8 bytes"):
        hash_password(password)


def test_bcrypt_legacy_hashes_still_verify():
    password = "a" * 72
    hashed = hash_password(password)
    assert verify_password(password + "legacy suffix", hashed)
    assert not verify_password("b" + password, hashed)


async def test_signup_verification_and_login(api, monkeypatch):
    from unittest.mock import AsyncMock
    from app.services import auth_service

    mail = AsyncMock()
    monkeypatch.setattr(auth_service, "send_verification_email", mail)
    client, _ = api
    register = await client.post(AUTH + "/register", json={"email": "new@example.com", "password": PASSWORD, "full_name": "New User", "business_name": "Test Business"})
    assert register.status_code == 201, register.text
    token = mail.await_args.args[1]
    assert verify_token(token, "email_verify")["sub"] == register.json()["data"]["user_id"]
    assert (await client.post(AUTH + "/verify-email", json={"token": token})).status_code == 200
    login = (await client.post(AUTH + "/login", json={"email": "new@example.com", "password": PASSWORD})).json()["data"]
    me = await client.get(AUTH + "/me", headers={"Authorization": "Bearer " + login["access_token"]})
    assert me.json()["data"]["is_verified"] is True


async def test_password_reset_link_is_single_use(api, monkeypatch):
    from unittest.mock import AsyncMock
    from app.services import auth_service

    email = AsyncMock()
    monkeypatch.setattr(auth_service, "send_password_reset", email)
    client, _ = api
    forgot = await client.post(AUTH + "/forgot-password", json={"email": "a@example.com"})
    assert forgot.status_code == 200
    token = email.await_args.args[1]
    request = {"token": token, "new_password": "different-synthetic-passphrase"}
    assert (await client.post(AUTH + "/reset-password", json=request)).status_code == 200
    assert (await client.post(AUTH + "/reset-password", json=request)).status_code == 400
    login = await client.post(AUTH + "/login", json={"email": "a@example.com", "password": request["new_password"]})
    assert login.status_code == 200


async def test_existing_mfa_accounts_can_complete_login(api):
    client, users = api
    headers = authorization(users["a"])
    setup = await client.post(AUTH + "/mfa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    code = pyotp.TOTP(setup.json()["data"]["secret"]).now()
    assert (await client.post(AUTH + "/mfa/verify", json={"code": code}, headers=headers)).status_code == 200
    login = await client.post(AUTH + "/login", json={"email": "a@example.com", "password": PASSWORD})
    challenge = login.json()["data"]
    assert "access_token" not in challenge
    invalid = ("0" if code[0] != "0" else "1") + code[1:]
    assert (await client.post(AUTH + "/mfa/login", json={"challenge_token": challenge["challenge_token"], "code": invalid})).status_code == 401
    complete = await client.post(AUTH + "/mfa/login", json={"challenge_token": challenge["challenge_token"], "code": code})
    assert complete.status_code == 200, complete.text
    assert "access_token" in complete.json()["data"]
    assert (await client.post(AUTH + "/mfa/setup", headers=headers)).status_code == 400


async def test_refresh_token_not_accepted_as_access_token(api):
    client, users = api
    refresh = create_refresh_token({"sub": str(users["a"].id)})
    denied = await client.get(AUTH + "/me", headers={"Authorization": "Bearer " + refresh})
    assert denied.status_code == 401
    renewed = await client.post(AUTH + "/refresh", json={"refresh_token": refresh})
    assert renewed.status_code == 200


async def test_registration_disabled_without_deployment_opt_in(api, monkeypatch):
    client, _ = api
    monkeypatch.setattr(settings, "ALLOW_SIGNUPS", False)
    response = await client.post(AUTH + "/register", json={"email": "new@example.com", "password": PASSWORD, "full_name": "New User", "business_name": "New Workspace"})
    assert response.status_code == 403


async def test_nonadministrator_cannot_read_admin_health(api):
    client, users = api
    response = await client.get("/api/v1/admin/health", headers=authorization(users["a"]))
    assert response.status_code == 403


async def test_production_unknown_platform_connection_cannot_report_success(api):
    client, users = api
    response = await client.post("/api/v1/platforms/connect", headers=authorization(users["a"]), json={"platform": "google", "credentials": {}})
    assert response.status_code == 503


async def test_streamed_upload_is_bounded(api, monkeypatch):
    client, users = api
    monkeypatch.setattr(settings, "MAX_REQUEST_BODY_SIZE", 100)

    async def chunks():
        yield b"x" * 60
        yield b"x" * 50

    response = await client.post("/api/v1/reviews/import", headers=authorization(users["a"]), content=chunks())
    assert response.status_code == 413


async def test_business_profile_is_tenant_scoped_and_persistent(api):
    client, users = api
    body = {"company_name": "QA Hardware", "industry": "Retail", "business_description": "Independent hardware shop",
            "tone": "friendly", "reply_length": "short", "support_contact": "support@example.com", "escalation_rules": "Route injuries to a manager."}
    first = authorization(users["a"])
    patch = await client.patch("/api/v1/brand/", json=body, headers=first)
    assert patch.status_code == 200, patch.text
    updated = (await client.get("/api/v1/brand/", headers=first)).json()
    assert {key: updated[key] for key in body} == body
    other = (await client.get("/api/v1/brand/", headers=authorization(users["b"]))).json()
    assert other["company_name"] != body["company_name"]


async def test_readiness_uses_database_and_liveness_is_separate(api):
    client, _ = api
    assert (await client.get("/health")).json()["status"] == "ok"
    assert (await client.get("/ready")).json()["status"] == "ready"
