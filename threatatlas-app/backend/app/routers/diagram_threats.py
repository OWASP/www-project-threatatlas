from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.database import get_db
from app.models import DiagramThreat as DiagramThreatModel, Diagram as DiagramModel, Threat as ThreatModel, User as UserModel, Model as ModelDB, Product as ProductModel, ProductCollaborator
from app.schemas import DiagramThreat, DiagramThreatCreate, DiagramThreatUpdate, DiagramThreatWithDetails
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_standard_or_admin, can_access_product, can_edit_product, PermissionDenied
from app.models.enums import UserRole
from app.services.audit import log_event
from app.services.risk_service import calculate_risk
from app.services.notification_service import (
    notify_threat_added,
    notify_approval_needed,
    notify_approval_decided,
)

router = APIRouter(prefix="/diagram-threats", tags=["diagram-threats"])


def _notify_review_decision(db, db_diagram_threat, review_status: str, reviewer: UserModel) -> None:
    """Find the user who accepted the risk and notify them of the decision."""
    from app.models.audit_event import AuditEvent

    threat_name = db_diagram_threat.threat.name if db_diagram_threat.threat else "Unknown"
    product = db_diagram_threat.diagram.product
    reviewer_name = reviewer.full_name or reviewer.email

    # Find the user who accepted the threat via the audit log
    accepter_id: int | None = None
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
            if str(details.get("diagram_threat_id", "")) == str(db_diagram_threat.id):
                accepter_id = event.user_id
                break
    except Exception:
        pass

    if accepter_id:
        notify_approval_decided(
            db,
            decided_by_name=reviewer_name,
            status=review_status,
            threat_name=threat_name,
            accepter_id=accepter_id,
            link=f"/products/{product.id}" if product else "/approvals",
        )


def calculate_risk_score_and_severity(likelihood: int | None, impact: int | None) -> tuple[int | None, str | None]:
    """Calculate risk score and severity based on likelihood and impact.

    Thin wrapper kept for backward compatibility; the scoring logic now lives
    in :mod:`app.services.risk_service`.
    """
    return calculate_risk(likelihood, impact)


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
        joinedload(DiagramThreatModel.diagram).joinedload(DiagramModel.product),
        joinedload(DiagramThreatModel.acceptance_approver),
    )

    # Filter by access if not admin (owner, collaborator, or public product)
    if current_user.role != UserRole.ADMIN.value:
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
    result = []
    for dt in diagram_threats:
        item = DiagramThreatWithDetails.model_validate(dt)
        if dt.acceptance_approver:
            item.acceptance_approver_name = dt.acceptance_approver.full_name or dt.acceptance_approver.email
        result.append(item)
    return result


@router.get("/{diagram_threat_id}", response_model=DiagramThreatWithDetails)
def get_diagram_threat(
    diagram_threat_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a diagram threat by ID."""
    diagram_threat = db.query(DiagramThreatModel).options(
        joinedload(DiagramThreatModel.threat),
        joinedload(DiagramThreatModel.diagram).joinedload(DiagramModel.product),
        joinedload(DiagramThreatModel.acceptance_approver),
    ).filter(DiagramThreatModel.id == diagram_threat_id).first()
    if not diagram_threat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"DiagramThreat with id {diagram_threat_id} not found"
        )

    if not can_access_product(current_user, diagram_threat.diagram.product):
        raise PermissionDenied("Not authorized to access this diagram threat")

    item = DiagramThreatWithDetails.model_validate(diagram_threat)
    if diagram_threat.acceptance_approver:
        item.acceptance_approver_name = diagram_threat.acceptance_approver.full_name or diagram_threat.acceptance_approver.email
    return item


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
    log_event(
        db,
        action="threat_added",
        entity_type="threat",
        entity_name=threat.name if threat else None,
        details={"diagram_threat_id": db_diagram_threat.id, "element_id": db_diagram_threat.element_id},
        product_id=diagram.product_id,
        diagram_id=db_diagram_threat.diagram_id,
        user_id=current_user.id,
    )
    try:
        notify_threat_added(
            db,
            threat_name=threat.name,
            diagram_name=diagram.name,
            product=diagram.product,
            excluding_user_id=current_user.id,
        )
    except Exception:
        pass
    db.commit()
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

    # Parse date/datetime strings
    if 'acceptance_review_date' in update_data and update_data['acceptance_review_date']:
        try:
            update_data['acceptance_review_date'] = datetime.fromisoformat(update_data['acceptance_review_date'])
        except ValueError:
            update_data['acceptance_review_date'] = None

    if 'accepted_at' in update_data and update_data['accepted_at']:
        try:
            update_data['accepted_at'] = datetime.fromisoformat(update_data['accepted_at'])
        except ValueError:
            update_data['accepted_at'] = None

    status_changed = 'status' in update_data and update_data['status'] != db_diagram_threat.status
    old_status = db_diagram_threat.status if status_changed else None
    becoming_accepted = status_changed and update_data['status'] == 'accepted'

    # Auto-set accepted_at when status first transitions to accepted
    if becoming_accepted and not db_diagram_threat.accepted_at and 'accepted_at' not in update_data:
        update_data['accepted_at'] = datetime.now()

    # Handle acceptance review transitions
    review_status = update_data.get('acceptance_review_status')
    if review_status in ('approved', 'rejected'):
        update_data['acceptance_reviewed_at'] = datetime.now()
        if review_status == 'rejected':
            # Rejection resets the acceptance entirely
            update_data['status'] = 'identified'
            update_data['accepted_at'] = None
            update_data['acceptance_justification'] = None
            update_data['acceptance_approver_id'] = None
            update_data['acceptance_review_date'] = None

    for field, value in update_data.items():
        setattr(db_diagram_threat, field, value)

    db.commit()
    db.refresh(db_diagram_threat)

    if status_changed:
        log_event(
            db,
            action="threat_status_changed",
            entity_type="threat",
            entity_name=db_diagram_threat.threat.name if db_diagram_threat.threat else None,
            details={"diagram_threat_id": db_diagram_threat.id, "old_status": old_status, "new_status": db_diagram_threat.status},
            product_id=db_diagram_threat.diagram.product_id,
            diagram_id=db_diagram_threat.diagram_id,
            user_id=current_user.id,
        )
        db.commit()

    if becoming_accepted:
        log_event(
            db,
            action="threat_accepted",
            entity_type="threat",
            entity_name=db_diagram_threat.threat.name if db_diagram_threat.threat else None,
            details={
                "diagram_threat_id": db_diagram_threat.id,
                "justification": db_diagram_threat.acceptance_justification,
                "approver_id": db_diagram_threat.acceptance_approver_id,
            },
            product_id=db_diagram_threat.diagram.product_id,
            diagram_id=db_diagram_threat.diagram_id,
            user_id=current_user.id,
        )
        db.commit()
        # Notify the approver if one was set
        if db_diagram_threat.acceptance_approver_id:
            try:
                threat_name = db_diagram_threat.threat.name if db_diagram_threat.threat else "Unknown"
                product = db_diagram_threat.diagram.product
                diagram_name = db_diagram_threat.diagram.name
                notify_approval_needed(
                    db,
                    threat_name=threat_name,
                    product_name=product.name,
                    diagram_name=diagram_name,
                    approver_id=db_diagram_threat.acceptance_approver_id,
                    link="/approvals",
                )
                db.commit()
            except Exception:
                pass

    if review_status == 'approved':
        log_event(
            db,
            action="acceptance_approved",
            entity_type="threat",
            entity_name=db_diagram_threat.threat.name if db_diagram_threat.threat else None,
            details={
                "diagram_threat_id": db_diagram_threat.id,
                "note": db_diagram_threat.acceptance_review_note,
            },
            product_id=db_diagram_threat.diagram.product_id,
            diagram_id=db_diagram_threat.diagram_id,
            user_id=current_user.id,
        )
        db.commit()
        try:
            _notify_review_decision(db, db_diagram_threat, review_status, current_user)
            db.commit()
        except Exception:
            pass
    elif review_status == 'rejected':
        log_event(
            db,
            action="acceptance_rejected",
            entity_type="threat",
            entity_name=db_diagram_threat.threat.name if db_diagram_threat.threat else None,
            details={
                "diagram_threat_id": db_diagram_threat.id,
                "note": db_diagram_threat.acceptance_review_note,
            },
            product_id=db_diagram_threat.diagram.product_id,
            diagram_id=db_diagram_threat.diagram_id,
            user_id=current_user.id,
        )
        db.commit()
        try:
            _notify_review_decision(db, db_diagram_threat, review_status, current_user)
            db.commit()
        except Exception:
            pass

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

    threat_name = db_diagram_threat.threat.name if db_diagram_threat.threat else None
    product_id = db_diagram_threat.diagram.product_id
    diagram_id = db_diagram_threat.diagram_id

    db.delete(db_diagram_threat)
    db.commit()

    log_event(
        db,
        action="threat_removed",
        entity_type="threat",
        entity_name=threat_name,
        details={"diagram_threat_id": diagram_threat_id},
        product_id=product_id,
        diagram_id=diagram_id,
        user_id=current_user.id,
    )
    db.commit()
    return None
