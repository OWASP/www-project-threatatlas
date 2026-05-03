from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models import Model as ModelDB, Framework, DiagramThreat, DiagramMitigation, Diagram, User
from app.models.model import ModelStatus
from app.schemas.model import ModelCreate, ModelUpdate, ModelWithFramework
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/models", tags=["models"])


@router.post("/", response_model=ModelWithFramework, status_code=status.HTTP_201_CREATED)
def create_model(
    model_data: ModelCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new threat modeling model for a diagram."""
    # Verify diagram exists
    diagram = db.query(Diagram).filter(Diagram.id == model_data.diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")

    # Verify framework exists
    framework = db.query(Framework).filter(Framework.id == model_data.framework_id).first()
    if not framework:
        raise HTTPException(status_code=404, detail="Framework not found")

    # Check if model already exists for this diagram/framework combination
    existing_model = db.query(ModelDB).filter(
        ModelDB.diagram_id == model_data.diagram_id,
        ModelDB.framework_id == model_data.framework_id
    ).first()

    if existing_model:
        raise HTTPException(
            status_code=400,
            detail=f"A {framework.name} model already exists for this diagram"
        )

    # Create new model
    new_model = ModelDB(
        diagram_id=model_data.diagram_id,
        framework_id=model_data.framework_id,
        name=model_data.name,
        description=model_data.description,
        status=ModelStatus.in_progress,
        created_by=current_user.id
    )

    db.add(new_model)
    db.commit()
    db.refresh(new_model)

    # Return with framework name and counts
    return {
        **new_model.__dict__,
        "framework_name": framework.name,
        "threat_count": 0,
        "mitigation_count": 0
    }


@router.get("/{model_id}", response_model=ModelWithFramework)
def get_model(
    model_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific model by ID."""
    model = db.query(ModelDB).filter(ModelDB.id == model_id).first()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Get framework name and counts
    framework = db.query(Framework).filter(Framework.id == model.framework_id).first()
    threat_count = db.query(DiagramThreat).filter(DiagramThreat.model_id == model_id).count()
    mitigation_count = db.query(DiagramMitigation).filter(DiagramMitigation.model_id == model_id).count()

    return {
        **model.__dict__,
        "framework_name": framework.name if framework else "Unknown",
        "threat_count": threat_count,
        "mitigation_count": mitigation_count
    }


@router.get("/diagram/{diagram_id}", response_model=List[ModelWithFramework])
def list_diagram_models(
    diagram_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all models for a specific diagram."""
    # Verify diagram exists
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")

    # Get all models for this diagram
    models = db.query(ModelDB).filter(ModelDB.diagram_id == diagram_id).all()

    # Enrich with framework info and counts
    result = []
    for model in models:
        framework = db.query(Framework).filter(Framework.id == model.framework_id).first()
        threat_count = db.query(DiagramThreat).filter(DiagramThreat.model_id == model.id).count()
        mitigation_count = db.query(DiagramMitigation).filter(DiagramMitigation.model_id == model.id).count()

        result.append({
            **model.__dict__,
            "framework_name": framework.name if framework else "Unknown",
            "threat_count": threat_count,
            "mitigation_count": mitigation_count
        })

    return result


@router.put("/{model_id}", response_model=ModelWithFramework)
def update_model(
    model_id: int,
    model_update: ModelUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a model."""
    model = db.query(ModelDB).filter(ModelDB.id == model_id).first()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Update fields if provided
    if model_update.name is not None:
        model.name = model_update.name

    if model_update.description is not None:
        model.description = model_update.description

    if model_update.status is not None:
        model.status = model_update.status
        # Auto-set completed_at when status changes to completed
        if model_update.status == ModelStatus.completed and not model.completed_at:
            model.completed_at = datetime.utcnow()

    if model_update.completed_at is not None:
        model.completed_at = model_update.completed_at

    db.commit()
    db.refresh(model)

    # Get framework name and counts
    framework = db.query(Framework).filter(Framework.id == model.framework_id).first()
    threat_count = db.query(DiagramThreat).filter(DiagramThreat.model_id == model_id).count()
    mitigation_count = db.query(DiagramMitigation).filter(DiagramMitigation.model_id == model_id).count()

    return {
        **model.__dict__,
        "framework_name": framework.name if framework else "Unknown",
        "threat_count": threat_count,
        "mitigation_count": mitigation_count
    }


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_model(
    model_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a model and all its associated threats and mitigations.
    This is a cascading delete.
    """
    model = db.query(ModelDB).filter(ModelDB.id == model_id).first()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    db.delete(model)
    db.commit()

    return None


@router.get("/", response_model=List[ModelWithFramework])
def list_all_models(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all models (for admin purposes)."""
    models = db.query(ModelDB).all()

    # Enrich with framework info and counts
    result = []
    for model in models:
        framework = db.query(Framework).filter(Framework.id == model.framework_id).first()
        threat_count = db.query(DiagramThreat).filter(DiagramThreat.model_id == model.id).count()
        mitigation_count = db.query(DiagramMitigation).filter(DiagramMitigation.model_id == model.id).count()

        result.append({
            **model.__dict__,
            "framework_name": framework.name if framework else "Unknown",
            "threat_count": threat_count,
            "mitigation_count": mitigation_count
        })

    return result
