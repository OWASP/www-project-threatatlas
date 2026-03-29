from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import DiagramMitigation as DiagramMitigationModel, Diagram as DiagramModel, Mitigation as MitigationModel, User as UserModel, Model as ModelDB, Product as ProductModel, ProductCollaborator
from app.schemas import DiagramMitigation, DiagramMitigationCreate, DiagramMitigationUpdate, DiagramMitigationWithDetails
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_standard_or_admin, can_access_product, can_edit_product, PermissionDenied
from app.models.enums import UserRole

router = APIRouter(prefix="/diagram-mitigations", tags=["diagram-mitigations"])


@router.get("/", response_model=list[DiagramMitigationWithDetails])
def list_diagram_mitigations(
    diagram_id: int | None = None,
    model_id: int | None = None,
    element_id: str | None = None,
    skip: int = 0,
    limit: int = 100,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all diagram mitigations, optionally filtered by diagram, model, or element."""
    query = db.query(DiagramMitigationModel).options(
        joinedload(DiagramMitigationModel.mitigation),
        joinedload(DiagramMitigationModel.model),
        joinedload(DiagramMitigationModel.diagram).joinedload(DiagramModel.product)
    )

    # Filter by access if not admin (owner, collaborator, or public product)
    if current_user.role != UserRole.ADMIN.value:
        from sqlalchemy import or_
        accessible_diagram_ids = (
            db.query(DiagramModel.id)
            .join(ProductModel, DiagramModel.product_id == ProductModel.id)
            .outerjoin(ProductCollaborator,
                (ProductCollaborator.product_id == ProductModel.id) &
                (ProductCollaborator.user_id == current_user.id))
            .filter(
                or_(
                    ProductModel.user_id == current_user.id,
                    ProductCollaborator.user_id == current_user.id,
                    ProductModel.is_public == True
                )
            )
            .scalar_subquery()
        )
        query = query.filter(DiagramMitigationModel.diagram_id.in_(accessible_diagram_ids))

    if diagram_id is not None:
        query = query.filter(DiagramMitigationModel.diagram_id == diagram_id)
    if model_id is not None:
        query = query.filter(DiagramMitigationModel.model_id == model_id)
    if element_id is not None:
        query = query.filter(DiagramMitigationModel.element_id == element_id)
    diagram_mitigations = query.offset(skip).limit(limit).all()
    return diagram_mitigations


@router.get("/{diagram_mitigation_id}", response_model=DiagramMitigationWithDetails)
def get_diagram_mitigation(
    diagram_mitigation_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a diagram mitigation by ID."""
    diagram_mitigation = db.query(DiagramMitigationModel).options(
        joinedload(DiagramMitigationModel.mitigation),
        joinedload(DiagramMitigationModel.diagram).joinedload(DiagramModel.product)
    ).filter(DiagramMitigationModel.id == diagram_mitigation_id).first()
    if not diagram_mitigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DiagramMitigation with id {diagram_mitigation_id} not found"
        )

    if not can_access_product(current_user, diagram_mitigation.diagram.product):
        raise PermissionDenied("Not authorized to access this diagram mitigation")
    return diagram_mitigation


@router.post("/", response_model=DiagramMitigation, status_code=status.HTTP_201_CREATED)
def create_diagram_mitigation(
    diagram_mitigation: DiagramMitigationCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Attach a mitigation to a diagram element."""
    # Require write access
    require_standard_or_admin(current_user)

    # Check if diagram exists
    diagram = db.query(DiagramModel).options(joinedload(DiagramModel.product)).filter(
        DiagramModel.id == diagram_mitigation.diagram_id
    ).first()
    if not diagram:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagram with id {diagram_mitigation.diagram_id} not found"
        )

    if not can_edit_product(current_user, diagram.product):
        raise PermissionDenied("Not authorized to modify this diagram")

    # Check if model exists and belongs to this diagram
    model = db.query(ModelDB).filter(ModelDB.id == diagram_mitigation.model_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with id {diagram_mitigation.model_id} not found"
        )
    if model.diagram_id != diagram_mitigation.diagram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Model does not belong to this diagram"
        )

    # Check if mitigation exists
    mitigation = db.query(MitigationModel).filter(MitigationModel.id == diagram_mitigation.mitigation_id).first()
    if not mitigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mitigation with id {diagram_mitigation.mitigation_id} not found"
        )

    # Verify mitigation belongs to same framework as model
    if mitigation.framework_id != model.framework_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mitigation framework does not match model framework"
        )

    # Check if this mitigation is already attached to this element and threat in this model
    existing = db.query(DiagramMitigationModel).filter(
        DiagramMitigationModel.model_id == diagram_mitigation.model_id,
        DiagramMitigationModel.mitigation_id == diagram_mitigation.mitigation_id,
        DiagramMitigationModel.element_id == diagram_mitigation.element_id,
        DiagramMitigationModel.threat_id == diagram_mitigation.threat_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This mitigation is already attached to this threat"
        )

    db_diagram_mitigation = DiagramMitigationModel(**diagram_mitigation.model_dump())
    db.add(db_diagram_mitigation)
    db.commit()
    db.refresh(db_diagram_mitigation)
    return db_diagram_mitigation


@router.put("/{diagram_mitigation_id}", response_model=DiagramMitigation)
def update_diagram_mitigation(
    diagram_mitigation_id: int,
    diagram_mitigation: DiagramMitigationUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a diagram mitigation (e.g., change status or comments)."""
    # Require write access
    require_standard_or_admin(current_user)

    db_diagram_mitigation = db.query(DiagramMitigationModel).options(
        joinedload(DiagramMitigationModel.diagram).joinedload(DiagramModel.product)
    ).filter(DiagramMitigationModel.id == diagram_mitigation_id).first()
    if not db_diagram_mitigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DiagramMitigation with id {diagram_mitigation_id} not found"
        )

    if not can_edit_product(current_user, db_diagram_mitigation.diagram.product):
        raise PermissionDenied("Not authorized to modify this diagram mitigation")

    update_data = diagram_mitigation.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_diagram_mitigation, field, value)

    db.commit()
    db.refresh(db_diagram_mitigation)
    return db_diagram_mitigation


@router.delete("/{diagram_mitigation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diagram_mitigation(
    diagram_mitigation_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a mitigation from a diagram element."""
    # Require write access
    require_standard_or_admin(current_user)

    db_diagram_mitigation = db.query(DiagramMitigationModel).options(
        joinedload(DiagramMitigationModel.diagram).joinedload(DiagramModel.product)
    ).filter(DiagramMitigationModel.id == diagram_mitigation_id).first()
    if not db_diagram_mitigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DiagramMitigation with id {diagram_mitigation_id} not found"
        )

    if not can_edit_product(current_user, db_diagram_mitigation.diagram.product):
        raise PermissionDenied("Not authorized to delete this diagram mitigation")

    db.delete(db_diagram_mitigation)
    db.commit()
    return None
