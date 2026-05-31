"""Tests for the portfolio analytics endpoint (app/routers/analytics.py)."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Diagram,
    DiagramMitigation,
    DiagramThreat,
    Framework,
    Mitigation,
    Model,
    Product,
    ProductCollaborator,
    Threat,
    User,
)
from app.models.enums import CollaboratorRole, UserRole
from tests.conftest import _create_user, make_auth_headers


def _seed(
    db: Session,
    owner: User,
    *,
    is_public: bool = False,
    name: str = "P",
    threats: list[dict] | None = None,
    mitigations: list[dict] | None = None,
    diagram_updated_at: datetime | None = None,
) -> Product:
    fw = Framework(name=f"FW-{owner.id}-{name}", description="f")
    db.add(fw)
    db.flush()
    product = Product(user_id=owner.id, name=name, description="d", is_public=is_public)
    db.add(product)
    db.flush()
    diagram = Diagram(product_id=product.id, created_by=owner.id, name=f"{name}-DFD", current_version=1)
    if diagram_updated_at is not None:
        diagram.updated_at = diagram_updated_at
    db.add(diagram)
    db.flush()
    model = Model(diagram_id=diagram.id, framework_id=fw.id, name="M", created_by=owner.id)
    db.add(model)
    db.flush()
    for i, t in enumerate(threats or []):
        th = Threat(framework_id=fw.id, name=f"T{i}", category="Spoofing")
        db.add(th)
        db.flush()
        db.add(DiagramThreat(
            diagram_id=diagram.id, model_id=model.id, threat_id=th.id,
            element_id=t.get("element_id", f"n{i}"), element_type="node",
            status=t.get("status", "identified"), severity=t.get("severity"),
            likelihood=t.get("likelihood"), impact=t.get("impact"),
            risk_score=t.get("likelihood") * t.get("impact") if t.get("likelihood") and t.get("impact") else None,
        ))
    for i, m in enumerate(mitigations or []):
        mit = Mitigation(framework_id=fw.id, name=f"Mi{i}", category="Control")
        db.add(mit)
        db.flush()
        db.add(DiagramMitigation(
            diagram_id=diagram.id, model_id=model.id, mitigation_id=mit.id,
            element_id=m.get("element_id", f"n{i}"), element_type="node",
            status=m.get("status", "proposed"),
        ))
    db.flush()
    return product


def test_portfolio_requires_auth(client: TestClient):
    assert client.get("/api/analytics/portfolio").status_code == 401


def test_portfolio_empty_for_user_with_no_products(client: TestClient, user_headers: dict, db: Session):
    resp = client.get("/api/analytics/portfolio", headers=user_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["totals"]["products"] == 0
    assert data["mitigation_ratio"] == 1.0


def test_portfolio_aggregates_severity(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _seed(db, standard_user, name="A", threats=[
        {"severity": "critical"}, {"severity": "high"}, {"severity": "low"}, {"severity": None},
    ])
    resp = client.get("/api/analytics/portfolio", headers=user_headers)
    data = resp.json()
    sev = data["threats_by_severity"]
    assert sev["critical"] == 1 and sev["high"] == 1 and sev["low"] == 1 and sev["unscored"] == 1
    assert data["totals"]["threats"] == 4


def test_portfolio_excludes_other_users_products(client: TestClient, standard_user: User, other_user: User, user_headers: dict, db: Session):
    _seed(db, other_user, name="theirs", threats=[{"severity": "critical"}])
    resp = client.get("/api/analytics/portfolio", headers=user_headers)
    assert resp.json()["totals"]["products"] == 0


def test_portfolio_includes_public_products(client: TestClient, standard_user: User, other_user: User, user_headers: dict, db: Session):
    _seed(db, other_user, name="pub", is_public=True, threats=[{"severity": "high"}])
    resp = client.get("/api/analytics/portfolio", headers=user_headers)
    assert resp.json()["totals"]["products"] == 1


def test_portfolio_includes_collaborations(client: TestClient, standard_user: User, other_user: User, user_headers: dict, db: Session):
    p = _seed(db, other_user, name="shared", threats=[{"severity": "high"}])
    db.add(ProductCollaborator(product_id=p.id, user_id=standard_user.id, role=CollaboratorRole.VIEWER.value, added_by=other_user.id))
    db.flush()
    resp = client.get("/api/analytics/portfolio", headers=user_headers)
    assert resp.json()["totals"]["products"] == 1


def test_admin_sees_all_products(client: TestClient, admin_user: User, standard_user: User, admin_headers: dict, db: Session):
    _seed(db, standard_user, name="u1", threats=[{"severity": "high"}])
    resp = client.get("/api/analytics/portfolio", headers=admin_headers)
    assert resp.json()["totals"]["products"] >= 1


def test_unmitigated_high_critical_counts_open_only(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _seed(db, standard_user, name="risk", threats=[
        {"severity": "critical", "status": "identified", "element_id": "n1"},
        {"severity": "high", "status": "mitigated", "element_id": "n2"},
    ])
    data = client.get("/api/analytics/portfolio", headers=user_headers).json()
    assert data["unmitigated_high_critical"] == 1


def test_active_mitigation_marks_threat_mitigated(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    # High threat on element n1 with an implemented mitigation on n1 → not counted as open.
    _seed(db, standard_user, name="m", threats=[{"severity": "high", "status": "identified", "element_id": "n1"}],
          mitigations=[{"status": "implemented", "element_id": "n1"}])
    data = client.get("/api/analytics/portfolio", headers=user_headers).json()
    assert data["unmitigated_high_critical"] == 0
    assert data["mitigation_ratio"] == 1.0


def test_top_risk_products_ranked(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _seed(db, standard_user, name="low-risk", threats=[{"severity": "high", "element_id": "a"}])
    _seed(db, standard_user, name="high-risk", threats=[
        {"severity": "critical", "element_id": "b"},
        {"severity": "high", "element_id": "c"},
    ])
    data = client.get("/api/analytics/portfolio", headers=user_headers).json()
    top = data["top_risk_products"]
    assert top[0]["product_name"] == "high-risk"
    assert top[0]["open_high_critical"] == 2


def test_stale_diagrams_flagged(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    old = datetime.now(timezone.utc) - timedelta(days=200)
    _seed(db, standard_user, name="stale", diagram_updated_at=old, threats=[{"severity": "low"}])
    data = client.get("/api/analytics/portfolio", params={"stale_days": 90}, headers=user_headers).json()
    names = [d["product_name"] for d in data["stale_diagrams"]]
    assert "stale" in names


def test_fresh_diagrams_not_flagged_stale(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _seed(db, standard_user, name="fresh", threats=[{"severity": "low"}])
    data = client.get("/api/analytics/portfolio", params={"stale_days": 90}, headers=user_headers).json()
    assert all(d["product_name"] != "fresh" for d in data["stale_diagrams"])


def test_residual_risk_lowers_severity_distribution(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    # Critical threat (5x5=25) on element n1 with a verified mitigation on n1.
    # Inherent: critical. Residual: 25 * 0.4 = 10 -> medium.
    _seed(
        db, standard_user, name="resid",
        threats=[{"severity": "critical", "likelihood": 5, "impact": 5, "element_id": "n1", "status": "identified"}],
        mitigations=[{"status": "verified", "element_id": "n1"}],
    )
    data = client.get("/api/analytics/portfolio", headers=user_headers).json()
    assert data["threats_by_severity"]["critical"] == 1
    assert data["residual_by_severity"]["medium"] == 1
    assert data["residual_by_severity"]["critical"] == 0
    assert data["risk_reduction"] == pytest.approx(0.6)


def test_risk_reduction_zero_without_active_mitigations(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _seed(db, standard_user, name="nored",
          threats=[{"severity": "high", "likelihood": 4, "impact": 4, "element_id": "n1"}])
    data = client.get("/api/analytics/portfolio", headers=user_headers).json()
    assert data["risk_reduction"] == 0.0


def test_mitigations_by_status(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _seed(db, standard_user, name="mbs",
          mitigations=[{"status": "proposed"}, {"status": "implemented"}, {"status": "implemented"}])
    data = client.get("/api/analytics/portfolio", headers=user_headers).json()
    assert data["mitigations_by_status"]["proposed"] == 1
    assert data["mitigations_by_status"]["implemented"] == 2


def test_threats_by_category(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    # _seed sets every threat's category to "Spoofing".
    _seed(db, standard_user, name="cat", threats=[{"severity": "high"}, {"severity": "low"}])
    data = client.get("/api/analytics/portfolio", headers=user_headers).json()
    cats = {c["category"]: c["count"] for c in data["threats_by_category"]}
    assert cats.get("Spoofing") == 2


def test_risk_matrix_cells(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _seed(db, standard_user, name="matrix", threats=[
        {"severity": "critical", "likelihood": 5, "impact": 5, "element_id": "a"},
        {"severity": "critical", "likelihood": 5, "impact": 5, "element_id": "b"},
        {"severity": "medium", "likelihood": 2, "impact": 3, "element_id": "c"},
    ])
    data = client.get("/api/analytics/portfolio", headers=user_headers).json()
    cells = {(c["likelihood"], c["impact"]): c["count"] for c in data["risk_matrix"]}
    assert cells[(5, 5)] == 2
    assert cells[(2, 3)] == 1


def test_by_product_breakdown(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _seed(db, standard_user, name="alpha", threats=[{"severity": "critical"}, {"severity": "low"}],
          mitigations=[{"status": "proposed"}])
    _seed(db, standard_user, name="beta", threats=[{"severity": "high"}])
    data = client.get("/api/analytics/portfolio", headers=user_headers).json()
    by_product = {p["product_name"]: p for p in data["by_product"]}
    assert by_product["alpha"]["critical"] == 1
    assert by_product["alpha"]["low"] == 1
    assert by_product["alpha"]["threats"] == 2
    assert by_product["alpha"]["mitigations"] == 1
    assert by_product["beta"]["high"] == 1
    # Ranked by critical+high desc → alpha (1 crit) before beta (1 high)? both =1; ensure both present.
    assert set(by_product) == {"alpha", "beta"}
