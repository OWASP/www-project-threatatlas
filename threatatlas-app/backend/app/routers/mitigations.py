from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Mitigation as MitigationModel, Framework as FrameworkModel, User as UserModel
from app.schemas import Mitigation, MitigationCreate, MitigationUpdate
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_standard_or_admin

router = APIRouter(prefix="/mitigations", tags=["mitigations"])


@router.get("/", response_model=list[Mitigation])
def list_mitigations(
    framework_id: int | None = None,
    is_custom: bool | None = None,
    skip: int = 0,
    limit: int = 100,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all mitigations (global + own members of frameworks user can see)."""
    from sqlalchemy import or_
    query = db.query(MitigationModel)
    
    # Show mitigations that are NOT custom OR belong to the current user
    query = query.filter(
        or_(
            MitigationModel.is_custom == False,
            MitigationModel.user_id == current_user.id
        )
    )

    if framework_id is not None:
        query = query.filter(MitigationModel.framework_id == framework_id)
    if is_custom is not None:
        query = query.filter(MitigationModel.is_custom == is_custom)
    
    mitigations = query.offset(skip).limit(limit).all()
    return mitigations


@router.get("/{mitigation_id}", response_model=Mitigation)
def get_mitigation(
    mitigation_id: int, 
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a mitigation by ID."""
    mitigation = db.query(MitigationModel).filter(MitigationModel.id == mitigation_id).first()
    if not mitigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mitigation with id {mitigation_id} not found"
        )
    
    # Check access
    if mitigation.is_custom and mitigation.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this custom mitigation"
        )

    return mitigation


@router.post("/", response_model=Mitigation, status_code=status.HTTP_201_CREATED)
def create_mitigation(
    mitigation: MitigationCreate, 
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new mitigation."""
    # Require write access
    require_standard_or_admin(current_user)

    # Check if framework exists and user has access to it
    framework = db.query(FrameworkModel).filter(FrameworkModel.id == mitigation.framework_id).first()
    if not framework:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Framework with id {mitigation.framework_id} not found"
        )
    
    if framework.is_custom and framework.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot add mitigations to this framework"
        )

    db_mitigation = MitigationModel(
        **mitigation.model_dump(exclude={"user_id"}),
        user_id=current_user.id
    )
    db.add(db_mitigation)
    db.commit()
    db.refresh(db_mitigation)
    return db_mitigation


@router.put("/{mitigation_id}", response_model=Mitigation)
def update_mitigation(
    mitigation_id: int,
    mitigation: MitigationUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a mitigation."""
    # Require write access
    require_standard_or_admin(current_user)

    db_mitigation = db.query(MitigationModel).filter(MitigationModel.id == mitigation_id).first()
    if not db_mitigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mitigation with id {mitigation_id} not found"
        )

    # Check ownership
    if db_mitigation.is_custom and db_mitigation.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own custom mitigations"
        )
    
    if not db_mitigation.is_custom and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update standard mitigations"
        )

    update_data = mitigation.model_dump(exclude_unset=True)

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
                detail="You cannot move mitigations to this framework"
            )

    for field, value in update_data.items():
        setattr(db_mitigation, field, value)

    db.commit()
    db.refresh(db_mitigation)
    return db_mitigation


@router.delete("/{mitigation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mitigation(
    mitigation_id: int, 
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a mitigation."""
    # Require write access
    require_standard_or_admin(current_user)

    db_mitigation = db.query(MitigationModel).filter(MitigationModel.id == mitigation_id).first()
    if not db_mitigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mitigation with id {mitigation_id} not found"
        )

    # Check ownership
    if db_mitigation.is_custom and db_mitigation.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own custom mitigations"
        )
    
    if not db_mitigation.is_custom and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete standard mitigations"
        )

    db.delete(db_mitigation)
    db.commit()
    return None
