"""Tests for authentication endpoints and JWT/API-token middleware."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.password import get_password_hash
from app.models import User
from app.models.enums import UserRole
from tests.conftest import _create_user, make_auth_headers, make_expired_token


# ── POST /auth/login ───────────────────────────────────────────────────────────

def test_login_success(client: TestClient, db: Session):
    _create_user(db, "alice@test.com", password="secret")
    resp = client.post("/api/auth/login", json={"email": "alice@test.com", "password": "secret"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient, db: Session):
    _create_user(db, "bob@test.com", password="correct")
    resp = client.post("/api/auth/login", json={"email": "bob@test.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_email(client: TestClient):
    resp = client.post("/api/auth/login", json={"email": "nobody@test.com", "password": "x"})
    assert resp.status_code == 401


def test_login_inactive_user(client: TestClient, db: Session):
    user = _create_user(db, "inactive@test.com", password="pass")
    user.is_active = False
    db.flush()
    resp = client.post("/api/auth/login", json={"email": "inactive@test.com", "password": "pass"})
    assert resp.status_code == 400


# ── POST /auth/register ────────────────────────────────────────────────────────

def test_register_is_disabled(client: TestClient):
    resp = client.post(
        "/api/auth/register",
        json={"email": "new@test.com", "username": "new", "password": "Str0ng!Pass"},
    )
    assert resp.status_code == 403


# ── GET /auth/me ───────────────────────────────────────────────────────────────

def test_get_me_authenticated(client: TestClient, standard_user: User, user_headers: dict):
    resp = client.get("/api/auth/me", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == standard_user.email


def test_get_me_no_token(client: TestClient):
    resp = client.get("/api/auth/me")
    assert resp.status_code in (401, 403)


def test_get_me_invalid_token(client: TestClient):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer notavalidtoken"})
    assert resp.status_code in (401, 403)


def test_get_me_expired_token(client: TestClient, standard_user: User):
    token = make_expired_token(standard_user)
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code in (401, 403)


def test_get_me_inactive_user_token(client: TestClient, db: Session):
    user = _create_user(db, "sleepy@test.com")
    headers = make_auth_headers(user)
    user.is_active = False
    db.flush()
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code in (401, 403)
