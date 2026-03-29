from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Diagram as DiagramModel, DiagramVersion as DiagramVersionModel, User as UserModel
from app.schemas.diagram_version import (
    DiagramVersion,
    DiagramVersionSummary,
    DiagramVersionComparison,
    VersionCreateRequest
)
from app.services import VersionService
from app.auth.dependencies import get_current_user
from app.auth.permissions import can_access_product, can_edit_product, PermissionDenied
from app.models.enums import UserRole

router = APIRouter(prefix="/diagram-versions", tags=["diagram-versions"])


def check_diagram_access(diagram_id: int, user: UserModel, db: Session) -> DiagramModel:
    """Helper to check if user can access diagram."""
    diagram = db.query(DiagramModel).filter(DiagramModel.id == diagram_id).first()
    if not diagram:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagram with id {diagram_id} not found"
        )
    if not can_access_product(user, diagram.product):
        raise PermissionDenied("Not authorized to access this diagram")
    return diagram


@router.get("/{diagram_id}/versions", response_model=list[DiagramVersionSummary])
def list_versions(
    diagram_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all versions for a diagram."""
    # Verify diagram exists and user has access
    diagram = check_diagram_access(diagram_id, current_user, db)

    # Get all versions, ordered by version number descending (newest first)
    versions = db.query(DiagramVersionModel).filter(
        DiagramVersionModel.diagram_id == diagram_id
    ).order_by(DiagramVersionModel.version_number.desc()).all()

    # Convert to summaries with statistics
    summaries = [
        VersionService.get_version_summary(db, version)
        for version in versions
    ]

    return summaries


@router.post("/{diagram_id}/versions", response_model=DiagramVersion, status_code=status.HTTP_201_CREATED)
def create_version(
    diagram_id: int,
    request: VersionCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually create a version snapshot."""
    # Get diagram and check access
    diagram = check_diagram_access(diagram_id, current_user, db)

    # Create version
    version = VersionService.create_version(
        db=db,
        diagram=diagram,
        comment=request.comment
    )

    return version


@router.get("/{diagram_id}/versions/compare", response_model=DiagramVersionComparison)
def compare_versions(
    diagram_id: int,
    current_user: UserModel = Depends(get_current_user),
    from_version: int = Query(..., description="Starting version number"),
    to_version: int = Query(..., description="Ending version number"),
    db: Session = Depends(get_db)
):
    """Compare two versions and return differences."""
    # Verify diagram exists and user has access
    diagram = check_diagram_access(diagram_id, current_user, db)

    try:
        comparison = VersionService.compare_versions(
            db=db,
            diagram_id=diagram_id,
            from_version=from_version,
            to_version=to_version
        )
        return comparison
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{diagram_id}/versions/{version_number}/restore", response_model=DiagramVersion)
def restore_version(
    diagram_id: int,
    version_number: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restore diagram to a previous version (creates new version)."""
    # Get diagram and check access
    diagram = check_diagram_access(diagram_id, current_user, db)

    try:
        new_version = VersionService.restore_version(
            db=db,
            diagram=diagram,
            version_number=version_number
        )
        return new_version
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/{diagram_id}/versions/{version_number}", response_model=DiagramVersion)
def get_version(
    diagram_id: int,
    version_number: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific version."""
    # Check diagram access first
    check_diagram_access(diagram_id, current_user, db)

    version = db.query(DiagramVersionModel).filter(
        DiagramVersionModel.diagram_id == diagram_id,
        DiagramVersionModel.version_number == version_number
    ).first()

    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_number} not found for diagram {diagram_id}"
        )

    return version


@router.delete("/{diagram_id}/versions/{version_number}", status_code=status.HTTP_204_NO_CONTENT)
def delete_version(
    diagram_id: int,
    version_number: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific version."""
    # Check diagram access first
    check_diagram_access(diagram_id, current_user, db)

    version = db.query(DiagramVersionModel).filter(
        DiagramVersionModel.diagram_id == diagram_id,
        DiagramVersionModel.version_number == version_number
    ).first()

    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version {version_number} not found for diagram {diagram_id}"
        )

    db.delete(version)
    db.commit()
    return None
