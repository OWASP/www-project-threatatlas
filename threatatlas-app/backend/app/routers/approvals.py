"""Approvals endpoints — lets designated approvers review accepted threats."""

from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func  # noqa: F401 — kept for potential future use

from app.database import get_db
from app.models import (
    DiagramThreat as DiagramThreatModel,
    Diagram as DiagramModel,
    User as UserModel,
    Product as ProductModel,
    AuditEvent,
)
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/approvals", tags=["approvals"])


def _build_approval_item(dt: DiagramThreatModel, accepted_by_name: str) -> dict:
    """Convert a DiagramThreat ORM object into the approvals response dict."""
    diagram = dt.diagram
    product = diagram.product if diagram else None
    threat = dt.threat

    return {
        "id": dt.id,
        "diagram_threat_id": dt.id,
        "threat_name": threat.name if threat else "Unknown",
        "category": threat.category if threat else None,
        "element_id": dt.element_id,
        "diagram_id": dt.diagram_id,
        "diagram_name": diagram.name if diagram else None,
        "product_id": product.id if product else None,
        "product_name": product.name if product else None,
        "accepted_by_name": accepted_by_name,
        "accepted_at": dt.accepted_at,
        "acceptance_justification": dt.acceptance_justification,
        "acceptance_review_date": dt.acceptance_review_date,
        "acceptance_review_status": dt.acceptance_review_status,
        "acceptance_review_note": dt.acceptance_review_note,
        "acceptance_reviewed_at": dt.acceptance_reviewed_at,
    }


def _get_accepted_by_name(db: Session, diagram_threat_id: int) -> str:
    """Look up the user who accepted a threat via the audit log."""
    try:
        events = (
            db.query(AuditEvent)
            .filter(AuditEvent.action == "threat_accepted")
            .order_by(AuditEvent.created_at.desc())
            .limit(200)
            .all()
        )
        for event in events:
            details = event.details or {}
            if str(details.get("diagram_threat_id", "")) == str(diagram_threat_id):
                if event.user_id:
                    user = db.query(UserModel).filter(UserModel.id == event.user_id).first()
                    if user:
                        return user.full_name or user.email
    except Exception:
        pass
    return "Unknown"


@router.get("/my/")
@router.get("/my")
def list_my_approvals(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all DiagramThreats where the current user is the assigned approver and the threat is accepted."""
    threats = (
        db.query(DiagramThreatModel)
        .options(
            joinedload(DiagramThreatModel.threat),
            joinedload(DiagramThreatModel.diagram).joinedload(DiagramModel.product),
        )
        .filter(
            DiagramThreatModel.acceptance_approver_id == current_user.id,
            DiagramThreatModel.status == "accepted",
        )
        .order_by(DiagramThreatModel.accepted_at.desc())
        .all()
    )

    result = []
    for dt in threats:
        accepted_by_name = _get_accepted_by_name(db, dt.id)
        result.append(_build_approval_item(dt, accepted_by_name))
    return result


@router.get("/my/count/")
@router.get("/my/count")
def get_my_approvals_count(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return count of pending (not yet reviewed) approvals for the current user."""
    count = (
        db.query(DiagramThreatModel)
        .filter(
            DiagramThreatModel.acceptance_approver_id == current_user.id,
            DiagramThreatModel.status == "accepted",
            DiagramThreatModel.acceptance_review_status.is_(None),
        )
        .count()
    )
    return {"count": count}
