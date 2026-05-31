"""Tests for the MITRE ATT&CK catalog and threat→technique mapping
(app/routers/attack.py)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Diagram,
    DiagramThreat,
    DiagramThreatAttackTechnique,
    Framework,
    Model,
    Product,
    Threat,
    User,
)
from app.models.enums import UserRole
from tests.conftest import _create_user, make_auth_headers


def _threat(db: Session, owner: User, *, is_public: bool = False) -> DiagramThreat:
    fw = Framework(name=f"FW-{owner.id}", description="f")
    db.add(fw)
    db.flush()
    product = Product(user_id=owner.id, name="P", description="d", is_public=is_public)
    db.add(product)
    db.flush()
    diagram = Diagram(product_id=product.id, created_by=owner.id, name="DFD", current_version=1)
    db.add(diagram)
    db.flush()
    model = Model(diagram_id=diagram.id, framework_id=fw.id, name="M", created_by=owner.id)
    db.add(model)
    db.flush()
    threat = Threat(framework_id=fw.id, name="T", category="Spoofing")
    db.add(threat)
    db.flush()
    dt = DiagramThreat(
        diagram_id=diagram.id, model_id=model.id, threat_id=threat.id,
        element_id="n1", element_type="node", status="identified",
    )
    db.add(dt)
    db.flush()
    return dt


# ── Catalog ────────────────────────────────────────────────────────────────────

def test_catalog_requires_auth(client: TestClient):
    assert client.get("/api/attack/techniques").status_code == 401


def test_list_techniques(client: TestClient, user_headers: dict):
    resp = client.get("/api/attack/techniques", headers=user_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 10
    assert any(t["technique_id"] == "T1190" for t in data)


def test_search_techniques_by_query(client: TestClient, user_headers: dict):
    resp = client.get("/api/attack/techniques", params={"q": "denial of service"}, headers=user_headers)
    ids = {t["technique_id"] for t in resp.json()}
    assert "T1499" in ids and "T1498" in ids
    assert "T1190" not in ids


def test_filter_techniques_by_tactic(client: TestClient, user_headers: dict):
    resp = client.get("/api/attack/techniques", params={"tactic": "Impact"}, headers=user_headers)
    data = resp.json()
    assert data and all(t["tactic"] == "Impact" for t in data)


def test_list_tactics(client: TestClient, user_headers: dict):
    resp = client.get("/api/attack/tactics", headers=user_headers)
    assert resp.status_code == 200
    assert "Initial Access" in resp.json()


# ── Mapping ──────────────────────────────────────────────────────────────────

def test_attach_technique(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    dt = _threat(db, standard_user)
    resp = client.post(f"/api/attack/diagram-threats/{dt.id}/techniques", json={"technique_id": "T1190"}, headers=user_headers)
    assert resp.status_code == 201
    assert resp.json()["technique_id"] == "T1190"
    assert resp.json()["name"] == "Exploit Public-Facing Application"
    assert db.query(DiagramThreatAttackTechnique).filter_by(diagram_threat_id=dt.id).count() == 1


def test_attach_is_idempotent(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    dt = _threat(db, standard_user)
    url = f"/api/attack/diagram-threats/{dt.id}/techniques"
    client.post(url, json={"technique_id": "T1190"}, headers=user_headers)
    client.post(url, json={"technique_id": "T1190"}, headers=user_headers)
    assert db.query(DiagramThreatAttackTechnique).filter_by(diagram_threat_id=dt.id).count() == 1


def test_attach_unknown_technique_400(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    dt = _threat(db, standard_user)
    resp = client.post(f"/api/attack/diagram-threats/{dt.id}/techniques", json={"technique_id": "T9999"}, headers=user_headers)
    assert resp.status_code == 400


def test_list_threat_techniques(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    dt = _threat(db, standard_user)
    client.post(f"/api/attack/diagram-threats/{dt.id}/techniques", json={"technique_id": "T1486"}, headers=user_headers)
    resp = client.get(f"/api/attack/diagram-threats/{dt.id}/techniques", headers=user_headers)
    assert resp.status_code == 200
    assert [t["technique_id"] for t in resp.json()] == ["T1486"]


def test_detach_technique(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    dt = _threat(db, standard_user)
    url = f"/api/attack/diagram-threats/{dt.id}/techniques"
    client.post(url, json={"technique_id": "T1190"}, headers=user_headers)
    resp = client.delete(f"{url}/T1190", headers=user_headers)
    assert resp.status_code == 204
    assert db.query(DiagramThreatAttackTechnique).filter_by(diagram_threat_id=dt.id).count() == 0


def test_attach_forbidden_for_stranger(client: TestClient, standard_user: User, other_headers: dict, db: Session):
    dt = _threat(db, standard_user, is_public=False)
    resp = client.post(f"/api/attack/diagram-threats/{dt.id}/techniques", json={"technique_id": "T1190"}, headers=other_headers)
    assert resp.status_code == 403


def test_attach_forbidden_for_readonly(client: TestClient, standard_user: User, db: Session):
    dt = _threat(db, standard_user)
    ro = _create_user(db, "ro@t.com", role=UserRole.READ_ONLY.value)
    resp = client.post(f"/api/attack/diagram-threats/{dt.id}/techniques", json={"technique_id": "T1190"}, headers=make_auth_headers(ro))
    assert resp.status_code == 403


def test_attach_missing_threat_404(client: TestClient, user_headers: dict, db: Session):
    resp = client.post("/api/attack/diagram-threats/999999/techniques", json={"technique_id": "T1190"}, headers=user_headers)
    assert resp.status_code == 404
