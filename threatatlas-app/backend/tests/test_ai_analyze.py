"""Tests for the one-click 'analyze diagram with AI' endpoint
(POST /ai-conversations/analyze-diagram).

The endpoint itself makes no LLM call — it validates access + AI configuration
and seeds a conversation — so every branch here is verifiable without a key.
Generation is driven separately through the existing streaming endpoint.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AIConfig, Diagram, Product, User
from app.models.ai import AIConversation
from app.models.enums import UserRole
from tests.conftest import _create_user, make_auth_headers


def _diagram(db: Session, owner: User, *, is_public: bool = False) -> Diagram:
    product = Product(user_id=owner.id, name="P", description="d", is_public=is_public)
    db.add(product)
    db.flush()
    diagram = Diagram(product_id=product.id, created_by=owner.id, name="DFD", current_version=1)
    db.add(diagram)
    db.flush()
    return diagram


def _enable_ai(db: Session) -> None:
    db.add(AIConfig(provider="openai", model_name="gpt-4o", api_key_encrypted=b"x", is_active=True))
    db.flush()


def _body(diagram_id: int) -> dict:
    return {"diagram_id": diagram_id}


def test_analyze_requires_auth(client: TestClient, standard_user: User, db: Session):
    d = _diagram(db, standard_user)
    assert client.post("/api/ai-conversations/analyze-diagram", json=_body(d.id)).status_code == 401


def test_analyze_missing_diagram_404(client: TestClient, user_headers: dict, db: Session):
    _enable_ai(db)
    resp = client.post("/api/ai-conversations/analyze-diagram", json=_body(999999), headers=user_headers)
    assert resp.status_code == 404


def test_analyze_forbidden_for_stranger(client: TestClient, standard_user: User, other_headers: dict, db: Session):
    _enable_ai(db)
    d = _diagram(db, standard_user, is_public=False)
    resp = client.post("/api/ai-conversations/analyze-diagram", json=_body(d.id), headers=other_headers)
    assert resp.status_code == 403


def test_analyze_forbidden_for_readonly(client: TestClient, standard_user: User, db: Session):
    _enable_ai(db)
    d = _diagram(db, standard_user)
    ro = _create_user(db, "ro@t.com", role=UserRole.READ_ONLY.value)
    resp = client.post("/api/ai-conversations/analyze-diagram", json=_body(d.id), headers=make_auth_headers(ro))
    assert resp.status_code == 403


def test_analyze_400_when_ai_not_configured(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    d = _diagram(db, standard_user)  # no AIConfig created
    resp = client.post("/api/ai-conversations/analyze-diagram", json=_body(d.id), headers=user_headers)
    assert resp.status_code == 400
    assert "not configured" in resp.json()["detail"].lower()


def test_analyze_seeds_conversation(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _enable_ai(db)
    d = _diagram(db, standard_user)
    resp = client.post("/api/ai-conversations/analyze-diagram", json=_body(d.id), headers=user_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["diagram_id"] == d.id
    assert "STRIDE" in data["prompt"]
    # Conversation actually persisted for this diagram/user.
    conv = db.query(AIConversation).filter(AIConversation.id == data["conversation_id"]).first()
    assert conv is not None
    assert conv.diagram_id == d.id
    assert conv.user_id == standard_user.id
    assert conv.title == "AI Threat Analysis"
