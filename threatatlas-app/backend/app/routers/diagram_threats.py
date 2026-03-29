from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import DiagramThreat as DiagramThreatModel, Diagram as DiagramModel, Threat as ThreatModel, User as UserModel, Model as ModelDB, Product as ProductModel, ProductCollaborator
from app.schemas import DiagramThreat, DiagramThreatCreate, DiagramThreatUpdate, DiagramThreatWithDetails
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_standard_or_admin, can_access_product, can_edit_product, PermissionDenied
from app.models.enums import UserRole

router = APIRouter(prefix="/diagram-threats", tags=["diagram-threats"])


def calculate_risk_score_and_severity(likelihood: int | None, impact: int | None) -> tuple[int | None, str | None]:
    """Calculate risk score and severity based on likelihood and impact."""
    if likelihood is None or impact is None:
        return None, None

    risk_score = likelihood * impact

    if risk_score >= 20:
        severity = 'critical'
    elif risk_score >= 12:
        severity = 'high'
    elif risk_score >= 6:
        severity = 'medium'
    else:
        severity = 'low'

    return risk_score, severity


@router.get("/", response_model=list[DiagramThreatWithDetails])
def list_diagram_threats(
    diagram_id: int | None = None,
    model_id: int | None = None,
    element_id: str | None = None,
    skip: int = 0,
    limit: int = 100,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all diagram threats, optionally filtered by diagram, model, or element."""
    query = db.query(DiagramThreatModel).options(
        joinedload(DiagramThreatModel.threat),
        joinedload(DiagramThreatModel.model),
        joinedload(DiagramThreatModel.diagram).joinedload(DiagramModel.product)
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
        query = query.filter(DiagramThreatModel.diagram_id.in_(accessible_diagram_ids))

    if diagram_id is not None:
        query = query.filter(DiagramThreatModel.diagram_id == diagram_id)
    if model_id is not None:
        query = query.filter(DiagramThreatModel.model_id == model_id)
    if element_id is not None:
        query = query.filter(DiagramThreatModel.element_id == element_id)
    diagram_threats = query.offset(skip).limit(limit).all()
    return diagram_threats


@router.get("/{diagram_threat_id}", response_model=DiagramThreatWithDetails)
def get_diagram_threat(
    diagram_threat_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a diagram threat by ID."""
    diagram_threat = db.query(DiagramThreatModel).options(
        joinedload(DiagramThreatModel.threat),
        joinedload(DiagramThreatModel.diagram).joinedload(DiagramModel.product)
    ).filter(DiagramThreatModel.id == diagram_threat_id).first()
    if not diagram_threat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DiagramThreat with id {diagram_threat_id} not found"
        )

    if not can_access_product(current_user, diagram_threat.diagram.product):
        raise PermissionDenied("Not authorized to access this diagram threat")
    return diagram_threat


@router.post("/", response_model=DiagramThreat, status_code=status.HTTP_201_CREATED)
def create_diagram_threat(
    diagram_threat: DiagramThreatCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Attach a threat to a diagram element."""
    # Require write access
    require_standard_or_admin(current_user)

    # Check if diagram exists
    diagram = db.query(DiagramModel).options(joinedload(DiagramModel.product)).filter(
        DiagramModel.id == diagram_threat.diagram_id
    ).first()
    if not diagram:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagram with id {diagram_threat.diagram_id} not found"
        )

    if not can_edit_product(current_user, diagram.product):
        raise PermissionDenied("Not authorized to modify this diagram")

    # Check if model exists and belongs to this diagram
    model = db.query(ModelDB).filter(ModelDB.id == diagram_threat.model_id).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with id {diagram_threat.model_id} not found"
        )
    if model.diagram_id != diagram_threat.diagram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Model does not belong to this diagram"
        )

    # Check if threat exists
    threat = db.query(ThreatModel).filter(ThreatModel.id == diagram_threat.threat_id).first()
    if not threat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Threat with id {diagram_threat.threat_id} not found"
        )

    # Verify threat belongs to same framework as model
    if threat.framework_id != model.framework_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Threat framework does not match model framework"
        )

    # Check if this threat is already attached to this element in this model
    existing = db.query(DiagramThreatModel).filter(
        DiagramThreatModel.model_id == diagram_threat.model_id,
        DiagramThreatModel.threat_id == diagram_threat.threat_id,
        DiagramThreatModel.element_id == diagram_threat.element_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This threat is already attached to this element"
        )

    # Calculate risk score and severity
    threat_data = diagram_threat.model_dump()
    risk_score, severity = calculate_risk_score_and_severity(
        threat_data.get('likelihood'),
        threat_data.get('impact')
    )
    threat_data['risk_score'] = risk_score
    threat_data['severity'] = severity

    db_diagram_threat = DiagramThreatModel(**threat_data)
    db.add(db_diagram_threat)
    db.commit()
    db.refresh(db_diagram_threat)
    return db_diagram_threat


@router.put("/{diagram_threat_id}", response_model=DiagramThreat)
def update_diagram_threat(
    diagram_threat_id: int,
    diagram_threat: DiagramThreatUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a diagram threat (e.g., change status or comments)."""
    # Require write access
    require_standard_or_admin(current_user)

    db_diagram_threat = db.query(DiagramThreatModel).options(
        joinedload(DiagramThreatModel.diagram).joinedload(DiagramModel.product)
    ).filter(DiagramThreatModel.id == diagram_threat_id).first()
    if not db_diagram_threat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DiagramThreat with id {diagram_threat_id} not found"
        )

    if not can_edit_product(current_user, db_diagram_threat.diagram.product):
        raise PermissionDenied("Not authorized to modify this diagram threat")

    update_data = diagram_threat.model_dump(exclude_unset=True)

    # Recalculate risk score when likelihood or impact changes
    if 'likelihood' in update_data or 'impact' in update_data:
        likelihood = update_data.get('likelihood', db_diagram_threat.likelihood)
        impact = update_data.get('impact', db_diagram_threat.impact)
        risk_score, severity = calculate_risk_score_and_severity(likelihood, impact)
        update_data['risk_score'] = risk_score
        update_data['severity'] = severity

    for field, value in update_data.items():
        setattr(db_diagram_threat, field, value)

    db.commit()
    db.refresh(db_diagram_threat)
    return db_diagram_threat


@router.delete("/{diagram_threat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diagram_threat(
    diagram_threat_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a threat from a diagram element."""
    # Require write access
    require_standard_or_admin(current_user)

    db_diagram_threat = db.query(DiagramThreatModel).options(
        joinedload(DiagramThreatModel.diagram).joinedload(DiagramModel.product)
    ).filter(DiagramThreatModel.id == diagram_threat_id).first()
    if not db_diagram_threat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DiagramThreat with id {diagram_threat_id} not found"
        )

    if not can_edit_product(current_user, db_diagram_threat.diagram.product):
        raise PermissionDenied("Not authorized to delete this diagram threat")

    db.delete(db_diagram_threat)
    db.commit()
    return None
