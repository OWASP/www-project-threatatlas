"""Portfolio-level analytics across all products a user can access.

The frontend Analytics page historically fetched every product, diagram and
threat and aggregated them in the browser. This endpoint does the rollup
server-side in a handful of queries, scoped to what the caller may see, so the
client gets an org-wide risk picture without downloading the whole dataset.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    Diagram as DiagramModel,
    DiagramMitigation,
    DiagramThreat,
    Product as ProductModel,
    ProductCollaborator,
    User as UserModel,
)
from app.auth.dependencies import get_current_user
from app.models.enums import UserRole
from app.services import risk_service

router = APIRouter(prefix="/analytics", tags=["analytics"])

_ACTIVE_MITIGATION_STATUSES = ("implemented", "verified")


def _accessible_product_ids(user: UserModel, db: Session) -> list[int]:
    """IDs of products the user owns, collaborates on, or that are public.

    Mirrors the access rule used by the search router so the two stay
    consistent; admins see everything.
    """
    if user.effective_role == UserRole.ADMIN.value:
        return [row[0] for row in db.query(ProductModel.id).all()]

    rows = (
        db.query(ProductModel.id)
        .outerjoin(
            ProductCollaborator,
            (ProductCollaborator.product_id == ProductModel.id)
            & (ProductCollaborator.user_id == user.id),
        )
        .filter(
            or_(
                ProductModel.user_id == user.id,
                ProductCollaborator.user_id == user.id,
                ProductModel.is_public.is_(True),
            )
        )
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


@router.get("/portfolio")
def portfolio_analytics(
    stale_days: int = Query(default=90, ge=1, le=3650, description="Diagrams untouched for this many days are flagged stale"),
    top_n: int = Query(default=5, ge=1, le=50, description="How many highest-risk products to return"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate risk posture across every product the caller can access."""
    product_ids = _accessible_product_ids(current_user, db)

    empty = {
        "totals": {"products": 0, "diagrams": 0, "threats": 0, "mitigations": 0},
        "threats_by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "unscored": 0},
        "residual_by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "unscored": 0},
        "threats_by_status": {},
        "mitigations_by_status": {},
        "threats_by_category": [],
        "risk_matrix": [],
        "by_product": [],
        "mitigation_ratio": 1.0,
        "risk_reduction": 0.0,
        "unmitigated_high_critical": 0,
        "top_risk_products": [],
        "stale_diagrams": [],
    }
    if not product_ids:
        return empty

    products = (
        db.query(ProductModel)
        .options(
            joinedload(ProductModel.diagrams)
            .joinedload(DiagramModel.diagram_threats)
            .joinedload(DiagramThreat.threat),
            joinedload(ProductModel.diagrams).joinedload(DiagramModel.diagram_mitigations),
        )
        .filter(ProductModel.id.in_(product_ids))
        .all()
    )

    by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0, "unscored": 0}
    residual_by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0, "unscored": 0}
    by_status: dict[str, int] = {}
    mitigations_by_status: dict[str, int] = {}
    by_category: dict[str, int] = {}
    # Risk matrix keyed by (likelihood, impact) -> count.
    risk_matrix: dict[tuple[int, int], int] = {}
    total_threats = 0
    total_mitigations = 0
    total_diagrams = 0
    mitigated_threats = 0
    unmitigated_high_critical = 0
    inherent_score_total = 0
    residual_score_total = 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=stale_days)
    stale_diagrams: list[dict] = []
    product_risk: list[dict] = []

    for product in products:
        p_high_critical_open = 0
        p_sev = {"critical": 0, "high": 0, "medium": 0, "low": 0, "unscored": 0}
        p_mitigations = 0
        for diagram in product.diagrams:
            total_diagrams += 1

            active_mitigated_elements = {
                dm.element_id
                for dm in diagram.diagram_mitigations
                if dm.status in _ACTIVE_MITIGATION_STATUSES
            }
            total_mitigations += len(diagram.diagram_mitigations)
            p_mitigations += len(diagram.diagram_mitigations)
            for dm in diagram.diagram_mitigations:
                mitigations_by_status[dm.status] = mitigations_by_status.get(dm.status, 0) + 1

            # Map element -> active mitigation statuses, for residual risk.
            element_mitigation_statuses: dict[str, list[str]] = {}
            for dm in diagram.diagram_mitigations:
                if dm.status in _ACTIVE_MITIGATION_STATUSES:
                    element_mitigation_statuses.setdefault(dm.element_id, []).append(dm.status)

            for dt in diagram.diagram_threats:
                total_threats += 1
                sev = dt.severity or "unscored"
                by_severity[sev] = by_severity.get(sev, 0) + 1
                p_sev[sev] = p_sev.get(sev, 0) + 1
                by_status[dt.status] = by_status.get(dt.status, 0) + 1

                category = (dt.threat.category if dt.threat else None) or "Uncategorized"
                by_category[category] = by_category.get(category, 0) + 1

                if dt.likelihood is not None and dt.impact is not None:
                    cell = (dt.likelihood, dt.impact)
                    risk_matrix[cell] = risk_matrix.get(cell, 0) + 1

                # Residual risk after active mitigations on the same element.
                statuses = element_mitigation_statuses.get(dt.element_id, [])
                res_score, res_sev = risk_service.residual_risk(dt.likelihood, dt.impact, statuses)
                residual_by_severity[res_sev or "unscored"] = residual_by_severity.get(res_sev or "unscored", 0) + 1
                if dt.risk_score is not None:
                    inherent_score_total += dt.risk_score
                    residual_score_total += res_score if res_score is not None else dt.risk_score

                is_mitigated = dt.status == "mitigated" or dt.element_id in active_mitigated_elements
                if is_mitigated:
                    mitigated_threats += 1
                if dt.severity in ("high", "critical") and not is_mitigated:
                    unmitigated_high_critical += 1
                    p_high_critical_open += 1

            updated = diagram.updated_at
            if updated is not None:
                if updated.tzinfo is None:
                    updated = updated.replace(tzinfo=timezone.utc)
                if updated < cutoff:
                    stale_diagrams.append({
                        "diagram_id": diagram.id,
                        "diagram_name": diagram.name,
                        "product_id": product.id,
                        "product_name": product.name,
                        "last_updated": updated.isoformat(),
                    })

        product_total = sum(p_sev.values())
        product_risk.append({
            "product_id": product.id,
            "product_name": product.name,
            "open_high_critical": p_high_critical_open,
            "critical": p_sev["critical"],
            "high": p_sev["high"],
            "medium": p_sev["medium"],
            "low": p_sev["low"],
            "unscored": p_sev["unscored"],
            "threats": product_total,
            "mitigations": p_mitigations,
        })

    top_risk_products = sorted(
        [
            {"product_id": p["product_id"], "product_name": p["product_name"], "open_high_critical": p["open_high_critical"]}
            for p in product_risk if p["open_high_critical"] > 0
        ],
        key=lambda p: p["open_high_critical"],
        reverse=True,
    )[:top_n]

    # Products that actually have threats, ranked by critical+high for the breakdown.
    by_product = sorted(
        [p for p in product_risk if p["threats"] > 0],
        key=lambda p: (p["critical"] + p["high"]),
        reverse=True,
    )

    stale_diagrams.sort(key=lambda d: d["last_updated"])

    top_categories = [
        {"category": cat, "count": count}
        for cat, count in sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)
    ]

    return {
        "totals": {
            "products": len(products),
            "diagrams": total_diagrams,
            "threats": total_threats,
            "mitigations": total_mitigations,
        },
        "threats_by_severity": by_severity,
        "residual_by_severity": residual_by_severity,
        "threats_by_status": by_status,
        "mitigations_by_status": mitigations_by_status,
        "threats_by_category": top_categories,
        "risk_matrix": [
            {"likelihood": lik, "impact": imp, "count": count}
            for (lik, imp), count in sorted(risk_matrix.items())
        ],
        "by_product": by_product,
        "mitigation_ratio": round(mitigated_threats / total_threats, 4) if total_threats else 1.0,
        "risk_reduction": round(1 - residual_score_total / inherent_score_total, 4) if inherent_score_total else 0.0,
        "unmitigated_high_critical": unmitigated_high_critical,
        "top_risk_products": top_risk_products,
        "stale_diagrams": stale_diagrams[:top_n],
    }
