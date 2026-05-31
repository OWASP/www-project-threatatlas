"""Product collaborator endpoints for sharing products."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    User as UserModel,
    Product as ProductModel,
    ProductCollaborator as CollaboratorModel
)
from app.schemas.collaborator import (
    CollaboratorAdd,
    CollaboratorUpdate,
    CollaboratorWithDetails
)
from app.auth.dependencies import get_current_user
from app.models.enums import CollaboratorRole, UserRole
from app.services.notification_service import notify_invitation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/products", tags=["collaborators"])


def can_manage_collaborators(user: UserModel, product: ProductModel) -> bool:
    """Check if user can manage collaborators for a product."""
    # Product owner can manage
    if product.user_id == user.id:
        return True

    # Collaborators with 'owner' role can manage
    for collab in product.collaborators:
        if collab.user_id == user.id and collab.role == CollaboratorRole.OWNER.value:
            return True

    return False


@router.get("/{product_id}/members")
def list_product_members(
    product_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return users who own or collaborate on this product (for approver selection).
    """
    product = db.query(ProductModel).options(
        joinedload(ProductModel.collaborators)
    ).filter(ProductModel.id == product_id).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Check if user has access to this product (admins always allowed)
    has_access = (
        current_user.role == UserRole.ADMIN.value or
        product.user_id == current_user.id or
        any(c.user_id == current_user.id for c in product.collaborators)
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view product members"
        )

    # Collect owner + all collaborators
    user_ids = {product.user_id}
    for c in product.collaborators:
        user_ids.add(c.user_id)

    # Include all admin users (admins can act as approvers for any product)
    admin_users = db.query(UserModel).filter(UserModel.role == UserRole.ADMIN.value).all()
    for admin in admin_users:
        user_ids.add(admin.id)

    users = db.query(UserModel).filter(UserModel.id.in_(user_ids)).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "username": u.username,
        }
        for u in users
    ]


@router.get("/{product_id}/collaborators", response_model=list[CollaboratorWithDetails])
def list_collaborators(
    product_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all collaborators for a product.

    Args:
        product_id: Product ID
        current_user: Current authenticated user
        db: Database session

    Returns:
        List of collaborators with user details

    Raises:
        HTTPException: If product not found or user not authorized
    """
    product = db.query(ProductModel).options(
        joinedload(ProductModel.collaborators)
    ).filter(ProductModel.id == product_id).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Check if user has access to this product
    has_access = (
        product.user_id == current_user.id or
        any(c.user_id == current_user.id for c in product.collaborators)
    )

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view collaborators"
        )

    # Get all collaborators with user details
    collaborators = db.query(CollaboratorModel).options(
        joinedload(CollaboratorModel.user),
        joinedload(CollaboratorModel.added_by_user)
    ).filter(CollaboratorModel.product_id == product_id).all()

    result = []
    for collab in collaborators:
        result.append(CollaboratorWithDetails(
            id=collab.id,
            product_id=collab.product_id,
            user_id=collab.user_id,
            role=collab.role,
            added_by=collab.added_by,
            added_at=collab.added_at,
            user_email=collab.user.email,
            user_username=collab.user.username,
            user_full_name=collab.user.full_name,
            added_by_username=collab.added_by_user.username
        ))

    return result


@router.post("/{product_id}/collaborators", response_model=CollaboratorWithDetails, status_code=status.HTTP_201_CREATED)
def add_collaborator(
    product_id: int,
    collaborator_data: CollaboratorAdd,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a collaborator to a product.

    Args:
        product_id: Product ID
        collaborator_data: Collaborator data (user_id, role)
        current_user: Current authenticated user
        db: Database session

    Returns:
        Created collaborator with user details

    Raises:
        HTTPException: If not authorized, user not found, or already a collaborator
    """
    product = db.query(ProductModel).options(
        joinedload(ProductModel.collaborators)
    ).filter(ProductModel.id == product_id).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Check if current user can manage collaborators
    if not can_manage_collaborators(current_user, product):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to manage collaborators"
        )

    # Check if user to add exists
    user_to_add = db.query(UserModel).filter(UserModel.id == collaborator_data.user_id).first()
    if not user_to_add:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Cannot add product owner as collaborator
    if collaborator_data.user_id == product.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add product owner as collaborator"
        )

    # Check if already a collaborator
    existing = db.query(CollaboratorModel).filter(
        CollaboratorModel.product_id == product_id,
        CollaboratorModel.user_id == collaborator_data.user_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a collaborator"
        )

    # Create collaborator
    new_collaborator = CollaboratorModel(
        product_id=product_id,
        user_id=collaborator_data.user_id,
        role=collaborator_data.role,
        added_by=current_user.id
    )

    db.add(new_collaborator)
    db.commit()
    db.refresh(new_collaborator)

    # Load relationships for response
    db.refresh(new_collaborator)
    collab = db.query(CollaboratorModel).options(
        joinedload(CollaboratorModel.user),
        joinedload(CollaboratorModel.added_by_user)
    ).filter(CollaboratorModel.id == new_collaborator.id).first()

    try:
        notify_invitation(
            db,
            product_name=product.name,
            invitee_id=collaborator_data.user_id,
            link=f"/products/{product_id}",
        )
        db.commit()
    except Exception:
        pass

    return CollaboratorWithDetails(
        id=collab.id,
        product_id=collab.product_id,
        user_id=collab.user_id,
        role=collab.role,
        added_by=collab.added_by,
        added_at=collab.added_at,
        user_email=collab.user.email,
        user_username=collab.user.username,
        user_full_name=collab.user.full_name,
        added_by_username=collab.added_by_user.username
    )


@router.put("/{product_id}/collaborators/{user_id}", response_model=CollaboratorWithDetails)
def update_collaborator(
    product_id: int,
    user_id: int,
    update_data: CollaboratorUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a collaborator's role.

    Args:
        product_id: Product ID
        user_id: User ID of collaborator
        update_data: Update data (role)
        current_user: Current authenticated user
        db: Database session

    Returns:
        Updated collaborator with user details

    Raises:
        HTTPException: If not authorized or collaborator not found
    """
    product = db.query(ProductModel).options(
        joinedload(ProductModel.collaborators)
    ).filter(ProductModel.id == product_id).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Check if current user can manage collaborators
    if not can_manage_collaborators(current_user, product):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to manage collaborators"
        )

    # Find collaborator
    collaborator = db.query(CollaboratorModel).filter(
        CollaboratorModel.product_id == product_id,
        CollaboratorModel.user_id == user_id
    ).first()

    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found"
        )

    # Update role
    collaborator.role = update_data.role
    db.commit()
    db.refresh(collaborator)

    # Load relationships for response
    collab = db.query(CollaboratorModel).options(
        joinedload(CollaboratorModel.user),
        joinedload(CollaboratorModel.added_by_user)
    ).filter(CollaboratorModel.id == collaborator.id).first()

    return CollaboratorWithDetails(
        id=collab.id,
        product_id=collab.product_id,
        user_id=collab.user_id,
        role=collab.role,
        added_by=collab.added_by,
        added_at=collab.added_at,
        user_email=collab.user.email,
        user_username=collab.user.username,
        user_full_name=collab.user.full_name,
        added_by_username=collab.added_by_user.username
    )


@router.delete("/{product_id}/collaborators/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_collaborator(
    product_id: int,
    user_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove a collaborator from a product.

    Args:
        product_id: Product ID
        user_id: User ID of collaborator to remove
        current_user: Current authenticated user
        db: Database session

    Raises:
        HTTPException: If not authorized or collaborator not found
    """
    product = db.query(ProductModel).options(
        joinedload(ProductModel.collaborators)
    ).filter(ProductModel.id == product_id).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    # Check if current user can manage collaborators
    if not can_manage_collaborators(current_user, product):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to manage collaborators"
        )

    # Find collaborator
    collaborator = db.query(CollaboratorModel).filter(
        CollaboratorModel.product_id == product_id,
        CollaboratorModel.user_id == user_id
    ).first()

    if not collaborator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found"
        )

    db.delete(collaborator)
    db.commit()

    return None
