"""Read-only audit log endpoints."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User as UserModel, Product as ProductModel
from app.models.audit_event import AuditEvent
from app.auth.dependencies import get_current_user
from app.auth.permissions import can_access_product, require_admin, PermissionDenied

router = APIRouter(prefix="/audit", tags=["audit"])


# ── Response schema ────────────────────────────────────────────────────────────

class AuditEventRead(BaseModel):
    id: int
    action: str
    entity_type: str | None = None
    entity_name: str | None = None
    details: dict | None = None
    diagram_id: int | None = None
    user_name: str | None = None
    user_email: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/products/{product_id}", response_model=list[AuditEventRead])
def list_product_audit_events(
    product_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return audit events for a product ordered newest-first."""
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if not can_access_product(current_user, product):
        raise PermissionDenied("Not authorized to access this product")

    rows = (
        db.query(AuditEvent)
        .filter(AuditEvent.product_id == product_id)
        .order_by(AuditEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Collect unique user ids to resolve display names in one query
    user_ids = {row.user_id for row in rows if row.user_id is not None}
    users_by_id: dict[int, UserModel] = {}
    if user_ids:
        for u in db.query(UserModel).filter(UserModel.id.in_(user_ids)).all():
            users_by_id[u.id] = u

    result = []
    for row in rows:
        user = users_by_id.get(row.user_id) if row.user_id else None
        result.append(
            AuditEventRead(
                id=row.id,
                action=row.action,
                entity_type=row.entity_type,
                entity_name=row.entity_name,
                details=row.details,
                diagram_id=row.diagram_id,
                user_name=user.username if user else None,
                user_email=user.email if user else None,
                created_at=row.created_at,
            )
        )

    return result


@router.get("/global", response_model=list[AuditEventRead])
def list_global_audit_events(
    limit: int = 100,
    offset: int = 0,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin-only: return all audit events across every product, newest-first."""
    require_admin(current_user)

    rows = (
        db.query(AuditEvent)
        .order_by(AuditEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    user_ids = {row.user_id for row in rows if row.user_id is not None}
    users_by_id: dict[int, UserModel] = {}
    if user_ids:
        for u in db.query(UserModel).filter(UserModel.id.in_(user_ids)).all():
            users_by_id[u.id] = u

    # Resolve product names for context
    product_ids = {row.product_id for row in rows if row.product_id is not None}
    products_by_id: dict[int, str] = {}
    if product_ids:
        for p in db.query(ProductModel).filter(ProductModel.id.in_(product_ids)).all():
            products_by_id[p.id] = p.name

    result = []
    for row in rows:
        user = users_by_id.get(row.user_id) if row.user_id else None
        details = dict(row.details) if row.details else {}
        if row.product_id and row.product_id in products_by_id:
            details["product_name"] = products_by_id[row.product_id]
        result.append(
            AuditEventRead(
                id=row.id,
                action=row.action,
                entity_type=row.entity_type,
                entity_name=row.entity_name,
                details=details if details else None,
                diagram_id=row.diagram_id,
                user_name=user.username if user else None,
                user_email=user.email if user else None,
                created_at=row.created_at,
            )
        )
    return result
