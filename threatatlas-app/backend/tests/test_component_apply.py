"""Tests for the transactional 'apply component template' endpoint
(POST /component-templates/{id}/apply)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    ComponentTemplate,
    Diagram,
    DiagramThreat,
    DiagramMitigation,
    Framework,
    Mitigation,
    Model,
    Product,
    Threat,
    User,
)
from app.models.component_template_link import ComponentTemplateThreat, ComponentTemplateMitigation
from app.models.enums import UserRole
from tests.conftest import _create_user, make_auth_headers


def _setup(db: Session, owner: User, *, extra_framework: bool = False, tag: str = "a"):
    """Build a framework with 2 threats + 2 mitigations, a template linking them,
    and a product/diagram/model bound to that framework. Returns ids dict.

    ``tag`` keeps framework names and the template slug unique when a single test
    builds more than one setup.
    """
    fw = Framework(name=f"FW-{owner.id}-{tag}", description="f")
    db.add(fw)
    db.flush()

    threats = [Threat(framework_id=fw.id, name=f"T{i}", category="Spoofing") for i in range(2)]
    mits = [Mitigation(framework_id=fw.id, name=f"M{i}", category="Control") for i in range(2)]
    for o in threats + mits:
        db.add(o)
    db.flush()

    template = ComponentTemplate(name="S3 Bucket", slug=f"s3-{owner.id}-{tag}", category="Storage", node_type="datastore")
    db.add(template)
    db.flush()
    for t in threats:
        db.add(ComponentTemplateThreat(component_id=template.id, threat_id=t.id))
    for m in mits:
        db.add(ComponentTemplateMitigation(component_id=template.id, mitigation_id=m.id))

    # Optionally add a threat from a DIFFERENT framework linked to the template,
    # which must be skipped on apply because it doesn't match the model framework.
    foreign_threat_id = None
    if extra_framework:
        fw2 = Framework(name=f"FW2-{owner.id}-{tag}", description="other")
        db.add(fw2)
        db.flush()
        ft = Threat(framework_id=fw2.id, name="Foreign", category="X")
        db.add(ft)
        db.flush()
        db.add(ComponentTemplateThreat(component_id=template.id, threat_id=ft.id))
        foreign_threat_id = ft.id

    product = Product(user_id=owner.id, name="P", description="d")
    db.add(product)
    db.flush()
    diagram = Diagram(product_id=product.id, created_by=owner.id, name="DFD", current_version=1)
    db.add(diagram)
    db.flush()
    model = Model(diagram_id=diagram.id, framework_id=fw.id, name="M", created_by=owner.id)
    db.add(model)
    db.flush()

    return {
        "template_id": template.id,
        "diagram_id": diagram.id,
        "model_id": model.id,
        "product_id": product.id,
        "threat_ids": [t.id for t in threats],
        "mitigation_ids": [m.id for m in mits],
        "foreign_threat_id": foreign_threat_id,
    }


def _body(ids, **overrides):
    body = {
        "diagram_id": ids["diagram_id"],
        "model_id": ids["model_id"],
        "element_id": "node-1",
        "element_type": "node",
    }
    body.update(overrides)
    return body


def test_apply_requires_auth(client: TestClient, standard_user: User, db: Session):
    ids = _setup(db, standard_user)
    resp = client.post(f"/api/component-templates/{ids['template_id']}/apply", json=_body(ids))
    assert resp.status_code == 401


def test_apply_all_linked(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    ids = _setup(db, standard_user)
    resp = client.post(f"/api/component-templates/{ids['template_id']}/apply", json=_body(ids), headers=user_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data == {"threats_added": 2, "mitigations_added": 2, "threats_skipped": 0, "mitigations_skipped": 0}
    # Persisted on the element.
    assert db.query(DiagramThreat).filter(DiagramThreat.element_id == "node-1").count() == 2
    assert db.query(DiagramMitigation).filter(DiagramMitigation.element_id == "node-1").count() == 2


def test_apply_is_idempotent(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    ids = _setup(db, standard_user)
    url = f"/api/component-templates/{ids['template_id']}/apply"
    client.post(url, json=_body(ids), headers=user_headers)
    resp = client.post(url, json=_body(ids), headers=user_headers)
    data = resp.json()
    assert data["threats_added"] == 0 and data["mitigations_added"] == 0
    assert data["threats_skipped"] == 2 and data["mitigations_skipped"] == 2


def test_apply_subset_via_ids(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    ids = _setup(db, standard_user)
    resp = client.post(
        f"/api/component-templates/{ids['template_id']}/apply",
        json=_body(ids, threat_ids=[ids["threat_ids"][0]], mitigation_ids=[]),
        headers=user_headers,
    )
    data = resp.json()
    assert data["threats_added"] == 1
    assert data["mitigations_added"] == 0


def test_apply_skips_foreign_framework(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    ids = _setup(db, standard_user, extra_framework=True)
    resp = client.post(f"/api/component-templates/{ids['template_id']}/apply", json=_body(ids), headers=user_headers)
    data = resp.json()
    # Only the 2 same-framework threats apply; the foreign-framework one is excluded.
    assert data["threats_added"] == 2
    foreign = db.query(DiagramThreat).filter(DiagramThreat.threat_id == ids["foreign_threat_id"]).count()
    assert foreign == 0


def test_apply_forbidden_for_readonly(client: TestClient, standard_user: User, db: Session):
    ids = _setup(db, standard_user)
    ro = _create_user(db, "ro@t.com", role=UserRole.READ_ONLY.value)
    resp = client.post(
        f"/api/component-templates/{ids['template_id']}/apply",
        json=_body(ids), headers=make_auth_headers(ro),
    )
    assert resp.status_code == 403


def test_apply_forbidden_for_stranger(client: TestClient, standard_user: User, other_user: User, other_headers: dict, db: Session):
    ids = _setup(db, standard_user)
    resp = client.post(
        f"/api/component-templates/{ids['template_id']}/apply",
        json=_body(ids), headers=other_headers,
    )
    assert resp.status_code == 403


def test_apply_model_not_in_diagram_400(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    ids = _setup(db, standard_user, tag="a")
    other = _setup(db, standard_user, tag="b")  # a second diagram/model
    resp = client.post(
        f"/api/component-templates/{ids['template_id']}/apply",
        json=_body(ids, model_id=other["model_id"]),
        headers=user_headers,
    )
    assert resp.status_code == 400


def test_apply_missing_template_404(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    ids = _setup(db, standard_user)
    resp = client.post("/api/component-templates/999999/apply", json=_body(ids), headers=user_headers)
    assert resp.status_code == 404
