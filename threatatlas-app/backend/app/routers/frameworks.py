from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Framework as FrameworkModel, User as UserModel
from app.schemas import Framework, FrameworkCreate, FrameworkUpdate
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_standard_or_admin

router = APIRouter(prefix="/frameworks", tags=["frameworks"])


@router.get("/", response_model=list[Framework])
def list_frameworks(
    skip: int = 0,
    limit: int = 100,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all frameworks (global + own)."""
    # Show frameworks that are NOT custom OR belong to the current user
    from sqlalchemy import or_
    frameworks = db.query(FrameworkModel).filter(
        or_(
            FrameworkModel.is_custom == False,
            FrameworkModel.user_id == current_user.id
        )
    ).offset(skip).limit(limit).all()
    return frameworks


@router.get("/{framework_id}", response_model=Framework)
def get_framework(
    framework_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a framework by ID."""
    framework = db.query(FrameworkModel).filter(FrameworkModel.id == framework_id).first()
    if not framework:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Framework with id {framework_id} not found"
        )
    
    # Check access: global or current user's
    if framework.is_custom and framework.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this custom framework"
        )
        
    return framework


@router.post("/", response_model=Framework, status_code=status.HTTP_201_CREATED)
def create_framework(
    framework: FrameworkCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new framework."""
    # Require write access
    require_standard_or_admin(current_user)

    # Check if framework with same name exists (scoped to global + user)
    from sqlalchemy import or_
    existing = db.query(FrameworkModel).filter(
        FrameworkModel.name == framework.name
    ).filter(
        or_(
            FrameworkModel.is_custom == False,
            FrameworkModel.user_id == current_user.id
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Framework with name '{framework.name}' already exists"
        )

    db_framework = FrameworkModel(
        **framework.model_dump(exclude={"is_custom", "user_id"}),
        is_custom=True,
        user_id=current_user.id
    )
    db.add(db_framework)
    db.commit()
    db.refresh(db_framework)
    return db_framework


@router.put("/{framework_id}", response_model=Framework)
def update_framework(
    framework_id: int,
    framework: FrameworkUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a framework."""
    # Require write access
    require_standard_or_admin(current_user)

    db_framework = db.query(FrameworkModel).filter(FrameworkModel.id == framework_id).first()
    if not db_framework:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Framework with id {framework_id} not found"
        )

    # Check ownership
    if db_framework.is_custom and db_framework.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own custom frameworks"
        )
    
    if not db_framework.is_custom and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update standard frameworks"
        )

    update_data = framework.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_framework, field, value)

    db.commit()
    db.refresh(db_framework)
    return db_framework


@router.delete("/{framework_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_framework(
    framework_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a framework."""
    # Require write access
    require_standard_or_admin(current_user)

    db_framework = db.query(FrameworkModel).filter(FrameworkModel.id == framework_id).first()
    if not db_framework:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Framework with id {framework_id} not found"
        )

    # Check ownership
    if db_framework.is_custom and db_framework.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own custom frameworks"
        )
    
    if not db_framework.is_custom and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete standard frameworks"
        )

    # Delete any models referencing this framework
    # (The models.framework_id column is NOT NULL, so deleting the framework means
    # we must also delete the analyses that strictly depend on it)
    from app.models import Model as ModelModel
    db.query(ModelModel).filter(ModelModel.framework_id == framework_id).delete(
        synchronize_session=False
    )

    db.delete(db_framework)
    db.commit()
    return None
