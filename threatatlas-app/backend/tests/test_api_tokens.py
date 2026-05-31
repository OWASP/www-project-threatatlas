"""Tests for API token CRUD and ta_-prefixed authentication."""

import hashlib
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User
from app.models.api_token import ApiToken
from tests.conftest import _create_user, make_auth_headers


def _sha256(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Create / list / delete tokens ─────────────────────────────────────────────

def test_create_api_token(client: TestClient, user_headers: dict):
    resp = client.post(
        "/api/api-tokens/",
        json={"name": "CI token"},
        headers=user_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "CI token"
    assert body["token"].startswith("ta_")


def test_create_token_only_reveals_raw_once(client: TestClient, user_headers: dict):
    """The raw token must only appear in the creation response."""
    r1 = client.post("/api/api-tokens/", json={"name": "secret"}, headers=user_headers)
    assert r1.status_code == 201
    raw_token = r1.json()["token"]

    r2 = client.get("/api/api-tokens/", headers=user_headers)
    assert r2.status_code == 200
    listed = r2.json()
    assert all(t.get("token") != raw_token for t in listed), "Raw token must not appear in list response"


def test_list_tokens_belongs_to_owner(client: TestClient, standard_user: User, other_user: User, db: Session, user_headers: dict):
    other_headers = make_auth_headers(other_user)
    client.post("/api/api-tokens/", json={"name": "mine"}, headers=user_headers)
    client.post("/api/api-tokens/", json={"name": "theirs"}, headers=other_headers)

    resp = client.get("/api/api-tokens/", headers=user_headers)
    assert resp.status_code == 200
    names = [t["name"] for t in resp.json()]
    assert "mine" in names
    assert "theirs" not in names


def test_delete_api_token(client: TestClient, user_headers: dict):
    create = client.post("/api/api-tokens/", json={"name": "temp"}, headers=user_headers)
    token_id = create.json()["id"]

    resp = client.delete(f"/api/api-tokens/{token_id}", headers=user_headers)
    assert resp.status_code == 204

    list_resp = client.get("/api/api-tokens/", headers=user_headers)
    assert all(t["id"] != token_id for t in list_resp.json())


def test_delete_other_users_token_forbidden(client: TestClient, standard_user: User, other_user: User, user_headers: dict, db: Session):
    other_headers = make_auth_headers(other_user)
    create = client.post("/api/api-tokens/", json={"name": "theirs"}, headers=other_headers)
    token_id = create.json()["id"]

    resp = client.delete(f"/api/api-tokens/{token_id}", headers=user_headers)
    assert resp.status_code in (403, 404)


# ── Authentication via ta_ token ───────────────────────────────────────────────

def test_authenticate_with_api_token(client: TestClient, standard_user: User, user_headers: dict):
    create = client.post("/api/api-tokens/", json={"name": "auth-test"}, headers=user_headers)
    raw_token = create.json()["token"]

    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {raw_token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == standard_user.email


def test_expired_api_token_rejected(client: TestClient, standard_user: User, db: Session, user_headers: dict):
    create = client.post("/api/api-tokens/", json={"name": "expiring"}, headers=user_headers)
    token_id = create.json()["id"]
    raw_token = create.json()["token"]

    # Manually expire the token in the DB
    row = db.query(ApiToken).filter(ApiToken.id == token_id).first()
    row.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db.flush()

    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {raw_token}"})
    assert resp.status_code == 401


def test_nonexistent_api_token_rejected(client: TestClient):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer ta_thisdoesnotexist"})
    assert resp.status_code in (401, 403)
