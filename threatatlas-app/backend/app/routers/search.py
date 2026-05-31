"""Global search endpoint for ThreatAtlas."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import (
    User as UserModel,
    Product as ProductModel,
    Diagram as DiagramModel,
    Threat as ThreatModel,
    ProductCollaborator,
)
from app.models.mitigation import Mitigation as MitigationModel
from app.models.framework import Framework as FrameworkModel
from app.auth.dependencies import get_current_user
from app.models.enums import UserRole

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
def global_search(
    q: str = Query(default="", min_length=0),
    limit: int = Query(default=20),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search across products, diagrams, threats, and mitigations."""
    if len(q.strip()) < 2:
        return {"products": [], "diagrams": [], "threats": [], "mitigations": []}

    per_category = 5
    pattern = f"%{q.strip()}%"

    # --- Accessible product IDs ---
    if current_user.role == UserRole.ADMIN.value:
        accessible_product_ids_q = db.query(ProductModel.id)
    else:
        accessible_product_ids_q = (
            db.query(ProductModel.id)
            .outerjoin(
                ProductCollaborator,
                (ProductCollaborator.product_id == ProductModel.id)
                & (ProductCollaborator.user_id == current_user.id),
            )
            .filter(
                or_(
                    ProductModel.user_id == current_user.id,
                    ProductCollaborator.user_id == current_user.id,
                    ProductModel.is_public == True,
                )
            )
        )

    accessible_product_ids = [row[0] for row in accessible_product_ids_q.all()]

    # --- Products ---
    products_rows = (
        db.query(ProductModel)
        .filter(
            ProductModel.id.in_(accessible_product_ids),
            or_(
                ProductModel.name.ilike(pattern),
                ProductModel.description.ilike(pattern),
            ),
        )
        .limit(per_category)
        .all()
    )
    products = [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "type": "product",
        }
        for p in products_rows
    ]

    # --- Diagrams ---
    diagrams_rows = (
        db.query(DiagramModel)
        .filter(
            DiagramModel.product_id.in_(accessible_product_ids),
            DiagramModel.name.ilike(pattern),
        )
        .limit(per_category)
        .all()
    )
    # Collect product names for diagrams
    product_map = {p.id: p.name for p in products_rows}
    extra_product_ids = {d.product_id for d in diagrams_rows} - set(product_map.keys())
    if extra_product_ids:
        extra_products = (
            db.query(ProductModel.id, ProductModel.name)
            .filter(ProductModel.id.in_(extra_product_ids))
            .all()
        )
        for ep in extra_products:
            product_map[ep.id] = ep.name

    diagrams = [
        {
            "id": d.id,
            "name": d.name,
            "product_id": d.product_id,
            "product_name": product_map.get(d.product_id, ""),
            "type": "diagram",
        }
        for d in diagrams_rows
    ]

    # --- Threats (KB, non-custom only) ---
    threats_rows = (
        db.query(
            ThreatModel.id,
            ThreatModel.name,
            ThreatModel.category,
            FrameworkModel.id.label("framework_id"),
            FrameworkModel.name.label("framework_name"),
        )
        .join(FrameworkModel, ThreatModel.framework_id == FrameworkModel.id)
        .filter(
            ThreatModel.is_custom == False,
            or_(
                ThreatModel.name.ilike(pattern),
                ThreatModel.category.ilike(pattern),
                FrameworkModel.name.ilike(pattern),
            ),
        )
        .limit(per_category)
        .all()
    )
    threats = [
        {
            "id": row.id,
            "name": row.name,
            "category": row.category,
            "framework_name": row.framework_name,
            "type": "threat",
        }
        for row in threats_rows
    ]

    # --- Mitigations (KB, non-custom only) ---
    mitigations_rows = (
        db.query(MitigationModel)
        .filter(
            MitigationModel.is_custom == False,
            or_(
                MitigationModel.name.ilike(pattern),
                MitigationModel.category.ilike(pattern),
            ),
        )
        .limit(per_category)
        .all()
    )
    mitigations = [
        {
            "id": m.id,
            "name": m.name,
            "category": m.category,
            "type": "mitigation",
        }
        for m in mitigations_rows
    ]

    return {
        "products": products,
        "diagrams": diagrams,
        "threats": threats,
        "mitigations": mitigations,
    }
