from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Diagram as DiagramModel, Product as ProductModel, User as UserModel, ProductCollaborator
from app.models.enums import UserRole
from app.schemas import Diagram, DiagramCreate, DiagramUpdate
from app.services import VersionService
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_standard_or_admin, can_access_product, can_edit_product, PermissionDenied

router = APIRouter(prefix="/diagrams", tags=["diagrams"])


@router.get("/", response_model=list[Diagram])
def list_diagrams(
    current_user: UserModel = Depends(get_current_user),
    product_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    List all diagrams, optionally filtered by product.

    Admin users see all diagrams.
    Other users see only diagrams from their own products.
    """
    from sqlalchemy import or_

    query = db.query(DiagramModel).join(ProductModel)

    # Admins see all diagrams; others see diagrams from products they own, collaborate on, or that are public
    if current_user.role != UserRole.ADMIN.value:
        collab_product_ids = db.query(ProductCollaborator.product_id).filter(
            ProductCollaborator.user_id == current_user.id
        ).scalar_subquery()
        query = query.filter(
            or_(
                ProductModel.user_id == current_user.id,
                ProductModel.id.in_(collab_product_ids),
                ProductModel.is_public == True
            )
        )

    if product_id:
        # Verify product access
        product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        if not can_access_product(current_user, product):
            raise PermissionDenied("Not authorized to access this product")
        query = query.filter(DiagramModel.product_id == product_id)

    diagrams = query.offset(skip).limit(limit).all()
    return diagrams


@router.get("/{diagram_id}", response_model=Diagram)
def get_diagram(
    diagram_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a diagram by ID.

    Admin users can access any diagram.
    Other users can only access diagrams from their own products.
    """
    diagram = db.query(DiagramModel).filter(DiagramModel.id == diagram_id).first()
    if not diagram:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagram with id {diagram_id} not found"
        )

    # Check access through product (owner, collaborator, public, or admin)
    if not can_access_product(current_user, diagram.product):
        raise PermissionDenied("Not authorized to access this diagram")

    return diagram


@router.post("/", response_model=Diagram, status_code=status.HTTP_201_CREATED)
def create_diagram(
    diagram: DiagramCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new diagram.

    Requires standard or admin role (read-only users cannot create).
    Admin users can create diagrams for any product.
    Standard users can only create diagrams for their own products.
    """
    require_standard_or_admin(current_user)

    # Check if product exists and user owns it
    product = db.query(ProductModel).filter(ProductModel.id == diagram.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {diagram.product_id} not found"
        )

    if not can_edit_product(current_user, product):
        raise PermissionDenied("Not authorized to create diagrams for this product")

    db_diagram = DiagramModel(
        **diagram.model_dump(),
        created_by=current_user.id
    )
    db.add(db_diagram)
    db.commit()
    db.refresh(db_diagram)
    return db_diagram


@router.put("/{diagram_id}", response_model=Diagram)
def update_diagram(
    diagram_id: int,
    diagram: DiagramUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a diagram."""
    db_diagram = db.query(DiagramModel).filter(DiagramModel.id == diagram_id).first()
    if not db_diagram:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagram with id {diagram_id} not found"
        )

    if not can_edit_product(current_user, db_diagram.product):
        raise PermissionDenied("Not authorized to modify this diagram")

    update_data = diagram.model_dump(exclude_unset=True)

    # Extract version-related fields
    version_comment = update_data.pop("version_comment", None)
    auto_version = update_data.pop("auto_version", None)

    # Update auto_version setting if provided
    if auto_version is not None:
        db_diagram.auto_version = auto_version

    # If product_id is being updated, verify it exists and user owns it
    if "product_id" in update_data:
        product = db.query(ProductModel).filter(ProductModel.id == update_data["product_id"]).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with id {update_data['product_id']} not found"
            )
        if not can_edit_product(current_user, product):
                raise PermissionDenied("Not authorized to move diagram to this product")

    # Create version snapshot if auto_version is enabled or comment provided
    should_version = db_diagram.auto_version or version_comment is not None

    if should_version:
        try:
            VersionService.create_version(
                db=db,
                diagram=db_diagram,
                comment=version_comment
            )
        except Exception as e:
            # Log error but don't fail the update
            print(f"Failed to create version: {str(e)}")

    # Apply updates to diagram
    for field, value in update_data.items():
        setattr(db_diagram, field, value)

    db.commit()
    db.refresh(db_diagram)
    return db_diagram


@router.delete("/{diagram_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diagram(
    diagram_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a diagram."""
    db_diagram = db.query(DiagramModel).filter(DiagramModel.id == diagram_id).first()
    if not db_diagram:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagram with id {diagram_id} not found"
        )

    if not can_edit_product(current_user, db_diagram.product):
        raise PermissionDenied("Not authorized to delete this diagram")

    db.delete(db_diagram)
    db.commit()
    return None
