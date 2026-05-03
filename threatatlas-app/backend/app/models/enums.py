"""Enumeration types for the application."""

import enum


class UserRole(str, enum.Enum):
    """User role enumeration for RBAC."""

    ADMIN = "admin"           # Full access: invite users, manage all resources
    STANDARD = "standard"     # Create/edit own products, diagrams, threats
    READ_ONLY = "read_only"   # View-only access to all resources


class ProductStatus(str, enum.Enum):
    """Project lifecycle stage of a product."""

    DESIGN = "design"
    DEVELOPMENT = "development"
    TESTING = "testing"
    DEPLOYMENT = "deployment"
    PRODUCTION = "production"


class CollaboratorRole(str, enum.Enum):
    """Collaborator role enumeration for product sharing."""

    OWNER = "owner"           # Full control: can delete product, manage collaborators
    EDITOR = "editor"         # Can edit product and diagrams
    VIEWER = "viewer"         # Read-only access to product and diagrams
