"""Role-Based Access Control (RBAC) permissions."""

from fastapi import HTTPException, status

from app.models import User, Product
from app.models.enums import UserRole, CollaboratorRole


class PermissionDenied(HTTPException):
    """Exception raised when user lacks required permissions."""

    def __init__(self, detail: str = "Permission denied"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def require_admin(user: User) -> User:
    """
    Require the user to have admin role.

    Args:
        user: The current authenticated user

    Returns:
        The user if they have admin role

    Raises:
        PermissionDenied: If user does not have admin role
    """
    if user.role != UserRole.ADMIN.value:
        raise PermissionDenied("Admin role required for this action")
    return user


def require_standard_or_admin(user: User) -> User:
    """
    Require the user to have write access (standard or admin role).

    Args:
        user: The current authenticated user

    Returns:
        The user if they have standard or admin role

    Raises:
        PermissionDenied: If user has read-only role
    """
    if user.role == UserRole.READ_ONLY.value:
        raise PermissionDenied("Write access required for this action")
    return user


def can_modify_resource(user: User, resource_owner_id: int) -> bool:
    """
    Check if user can modify a resource.

    Admin users can modify any resource.
    Standard users can only modify their own resources.
    Read-only users cannot modify any resources.

    Args:
        user: The current authenticated user
        resource_owner_id: The ID of the user who owns the resource

    Returns:
        True if user can modify the resource, False otherwise
    """
    if user.role == UserRole.READ_ONLY.value:
        return False
    if user.role == UserRole.ADMIN.value:
        return True
    return resource_owner_id == user.id


def require_resource_access(user: User, resource_owner_id: int) -> User:
    """
    Require the user to have permission to modify a resource.

    Args:
        user: The current authenticated user
        resource_owner_id: The ID of the user who owns the resource

    Returns:
        The user if they can modify the resource

    Raises:
        PermissionDenied: If user cannot modify the resource
    """
    if not can_modify_resource(user, resource_owner_id):
        raise PermissionDenied("Not authorized to modify this resource")
    return user


def can_access_product(user: User, product: Product) -> bool:
    """
    Check if user can access a product (view or edit).

    Args:
        user: Current user
        product: Product to check access for

    Returns:
        True if user can access, False otherwise
    """
    # Admins can access all products
    if user.role == UserRole.ADMIN.value:
        return True

    # Public products accessible to all authenticated users
    if product.is_public:
        return True

    # Product owner can access
    if product.user_id == user.id:
        return True

    # Collaborators can access
    for collab in product.collaborators:
        if collab.user_id == user.id:
            return True

    return False


def require_product_access(user: User, product: Product) -> None:
    """Raise PermissionDenied if user cannot access the product."""
    if not can_access_product(user, product):
        raise PermissionDenied("Not authorized to access this resource")


def require_product_edit(user: User, product: Product) -> None:
    """Raise PermissionDenied if user cannot edit the product."""
    if not can_edit_product(user, product):
        raise PermissionDenied("Not authorized to modify this resource")


def can_edit_product(user: User, product: Product) -> bool:
    """
    Check if user can edit a product.

    Args:
        user: Current user
        product: Product to check edit access for

    Returns:
        True if user can edit, False otherwise
    """
    # Read-only users cannot edit
    if user.role == UserRole.READ_ONLY.value:
        return False

    # Admins can edit all products
    if user.role == UserRole.ADMIN.value:
        return True

    # Product owner can edit
    if product.user_id == user.id:
        return True

    # Collaborators with owner or editor role can edit
    for collab in product.collaborators:
        if collab.user_id == user.id and collab.role in [CollaboratorRole.OWNER.value, CollaboratorRole.EDITOR.value]:
            return True

    return False
