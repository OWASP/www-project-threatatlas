from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Threat as ThreatModel, Framework as FrameworkModel, User as UserModel
from app.schemas import Threat, ThreatCreate, ThreatUpdate
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_standard_or_admin

router = APIRouter(prefix="/threats", tags=["threats"])


@router.get("/", response_model=list[Threat])
def list_threats(
    framework_id: int | None = None,
    is_custom: bool | None = None,
    skip: int = 0,
    limit: int = 100,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all threats (global + own members of frameworks user can see)."""
    from sqlalchemy import or_
    query = db.query(ThreatModel)
    
    # Show threats that are NOT custom OR belong to the current user
    # If they are custom, they must belong to the current user
    # Also if the framework is custom, the user must have access to it (handled by framework filter naturally)
    query = query.filter(
        or_(
            ThreatModel.is_custom == False,
            ThreatModel.user_id == current_user.id
        )
    )

    if framework_id is not None:
        query = query.filter(ThreatModel.framework_id == framework_id)
    if is_custom is not None:
        query = query.filter(ThreatModel.is_custom == is_custom)
    
    threats = query.offset(skip).limit(limit).all()
    return threats


@router.get("/{threat_id}", response_model=Threat)
def get_threat(
    threat_id: int, 
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a threat by ID."""
    threat = db.query(ThreatModel).filter(ThreatModel.id == threat_id).first()
    if not threat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Threat with id {threat_id} not found"
        )
    
    # Check access
    if threat.is_custom and threat.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this custom threat"
        )

    return threat


@router.post("/", response_model=Threat, status_code=status.HTTP_201_CREATED)
def create_threat(
    threat: ThreatCreate, 
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new threat."""
    # Require write access
    require_standard_or_admin(current_user)

    # Check if framework exists and user has access to it
    framework = db.query(FrameworkModel).filter(FrameworkModel.id == threat.framework_id).first()
    if not framework:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Framework with id {threat.framework_id} not found"
        )
    
    if framework.is_custom and framework.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot add threats to this framework"
        )

    db_threat = ThreatModel(
        **threat.model_dump(exclude={"user_id"}),
        user_id=current_user.id
    )
    db.add(db_threat)
    db.commit()
    db.refresh(db_threat)
    return db_threat


@router.put("/{threat_id}", response_model=Threat)
def update_threat(
    threat_id: int,
    threat: ThreatUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a threat."""
    # Require write access
    require_standard_or_admin(current_user)

    db_threat = db.query(ThreatModel).filter(ThreatModel.id == threat_id).first()
    if not db_threat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Threat with id {threat_id} not found"
        )

    # Check ownership: custom threats only editable by owner or superuser
    if db_threat.is_custom and db_threat.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own custom threats"
        )

    update_data = threat.model_dump(exclude_unset=True)

    # If framework_id is being updated, verify it exists and user has access
    if "framework_id" in update_data:
        framework = db.query(FrameworkModel).filter(FrameworkModel.id == update_data["framework_id"]).first()
        if not framework:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Framework with id {update_data['framework_id']} not found"
            )
        if framework.is_custom and framework.user_id != current_user.id and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot move threats to this framework"
            )

    # Snapshot originals on first edit of a predefined threat
    if not db_threat.is_custom and not db_threat.is_modified:
        db_threat.original_name = db_threat.name
        db_threat.original_description = db_threat.description
        db_threat.original_category = db_threat.category
        db_threat.is_modified = True

    for field, value in update_data.items():
        setattr(db_threat, field, value)

    db.commit()
    db.refresh(db_threat)
    return db_threat


@router.post("/{threat_id}/revert", response_model=Threat)
def revert_threat(
    threat_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revert a modified predefined threat back to its original values."""
    require_standard_or_admin(current_user)

    db_threat = db.query(ThreatModel).filter(ThreatModel.id == threat_id).first()
    if not db_threat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Threat with id {threat_id} not found")

    if db_threat.is_custom:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only predefined threats can be reverted")

    if not db_threat.is_modified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Threat has not been modified")

    if db_threat.original_name is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revert: original name snapshot is missing",
        )

    db_threat.name = db_threat.original_name
    db_threat.description = db_threat.original_description
    db_threat.category = db_threat.original_category
    db_threat.is_modified = False
    db_threat.original_name = None
    db_threat.original_description = None
    db_threat.original_category = None

    db.commit()
    db.refresh(db_threat)
    return db_threat


@router.delete("/{threat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_threat(
    threat_id: int, 
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a threat."""
    # Require write access
    require_standard_or_admin(current_user)

    db_threat = db.query(ThreatModel).filter(ThreatModel.id == threat_id).first()
    if not db_threat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Threat with id {threat_id} not found"
        )

    # Check ownership
    if db_threat.is_custom and db_threat.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own custom threats"
        )
    
    if not db_threat.is_custom and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete standard threats"
        )

    db.delete(db_threat)
    db.commit()
    return None
