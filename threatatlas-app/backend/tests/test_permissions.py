"""Unit tests for the RBAC permission layer (app/auth/permissions.py).

These are the security-critical access-control primitives. They are pure
functions over User/Product objects, so the tests build real ORM objects in
the test transaction and assert the decision matrix directly — no HTTP layer.
"""

import pytest
from sqlalchemy.orm import Session

from app.models import Product, ProductCollaborator, User
from app.models.enums import UserRole, CollaboratorRole
from app.auth.permissions import (
    PermissionDenied,
    require_admin,
    require_standard_or_admin,
    can_modify_resource,
    require_resource_access,
    can_access_product,
    can_edit_product,
    require_product_access,
    require_product_edit,
)
from tests.conftest import _create_user


# ── Builders ──────────────────────────────────────────────────────────────────

def _product(db: Session, owner: User, is_public: bool = False) -> Product:
    p = Product(user_id=owner.id, name="P", description="d", is_public=is_public)
    db.add(p)
    db.flush()
    return p


def _add_collaborator(db: Session, product: Product, user: User, role: str, added_by: User) -> ProductCollaborator:
    c = ProductCollaborator(product_id=product.id, user_id=user.id, role=role, added_by=added_by.id)
    db.add(c)
    db.flush()
    db.refresh(product)
    return c


# ── require_admin ───────────────────────────────────────────────────────────────

def test_require_admin_allows_admin(db: Session):
    admin = _create_user(db, "a@t.com", role=UserRole.ADMIN.value)
    assert require_admin(admin) is admin


@pytest.mark.parametrize("role", [UserRole.STANDARD.value, UserRole.READ_ONLY.value])
def test_require_admin_rejects_non_admin(db: Session, role: str):
    u = _create_user(db, f"{role}@t.com", role=role)
    with pytest.raises(PermissionDenied):
        require_admin(u)


# ── require_standard_or_admin ────────────────────────────────────────────────────

@pytest.mark.parametrize("role", [UserRole.ADMIN.value, UserRole.STANDARD.value])
def test_require_write_allows_writers(db: Session, role: str):
    u = _create_user(db, f"{role}@t.com", role=role)
    assert require_standard_or_admin(u) is u


def test_require_write_rejects_read_only(db: Session):
    u = _create_user(db, "ro@t.com", role=UserRole.READ_ONLY.value)
    with pytest.raises(PermissionDenied):
        require_standard_or_admin(u)


# ── can_modify_resource ─────────────────────────────────────────────────────────

def test_owner_can_modify_own_resource(db: Session):
    u = _create_user(db, "u@t.com", role=UserRole.STANDARD.value)
    assert can_modify_resource(u, resource_owner_id=u.id) is True


def test_standard_cannot_modify_others_resource(db: Session):
    u = _create_user(db, "u@t.com", role=UserRole.STANDARD.value)
    other = _create_user(db, "o@t.com", role=UserRole.STANDARD.value)
    assert can_modify_resource(u, resource_owner_id=other.id) is False


def test_admin_can_modify_any_resource(db: Session):
    admin = _create_user(db, "a@t.com", role=UserRole.ADMIN.value)
    other = _create_user(db, "o@t.com", role=UserRole.STANDARD.value)
    assert can_modify_resource(admin, resource_owner_id=other.id) is True


def test_read_only_cannot_modify_even_own(db: Session):
    u = _create_user(db, "ro@t.com", role=UserRole.READ_ONLY.value)
    assert can_modify_resource(u, resource_owner_id=u.id) is False


def test_require_resource_access_raises_for_unauthorized(db: Session):
    u = _create_user(db, "u@t.com", role=UserRole.STANDARD.value)
    other = _create_user(db, "o@t.com", role=UserRole.STANDARD.value)
    with pytest.raises(PermissionDenied):
        require_resource_access(u, resource_owner_id=other.id)


# ── can_access_product (view) ─────────────────────────────────────────────────

def test_owner_can_access_own_product(db: Session):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    p = _product(db, owner)
    assert can_access_product(owner, p) is True


def test_stranger_cannot_access_private_product(db: Session):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    stranger = _create_user(db, "x@t.com", role=UserRole.STANDARD.value)
    p = _product(db, owner, is_public=False)
    assert can_access_product(stranger, p) is False


def test_anyone_can_access_public_product(db: Session):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    stranger = _create_user(db, "x@t.com", role=UserRole.READ_ONLY.value)
    p = _product(db, owner, is_public=True)
    assert can_access_product(stranger, p) is True


def test_admin_can_access_any_product(db: Session):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    admin = _create_user(db, "a@t.com", role=UserRole.ADMIN.value)
    p = _product(db, owner, is_public=False)
    assert can_access_product(admin, p) is True


@pytest.mark.parametrize("role", [CollaboratorRole.VIEWER.value, CollaboratorRole.EDITOR.value, CollaboratorRole.OWNER.value])
def test_collaborator_of_any_role_can_access(db: Session, role: str):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    collab = _create_user(db, "c@t.com", role=UserRole.STANDARD.value)
    p = _product(db, owner, is_public=False)
    _add_collaborator(db, p, collab, role, owner)
    assert can_access_product(collab, p) is True


# ── can_edit_product ─────────────────────────────────────────────────────────

def test_owner_can_edit(db: Session):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    p = _product(db, owner)
    assert can_edit_product(owner, p) is True


def test_read_only_cannot_edit_even_public(db: Session):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    ro = _create_user(db, "ro@t.com", role=UserRole.READ_ONLY.value)
    p = _product(db, owner, is_public=True)
    assert can_edit_product(ro, p) is False


@pytest.mark.parametrize(
    "role,expected",
    [
        (CollaboratorRole.OWNER.value, True),
        (CollaboratorRole.EDITOR.value, True),
        (CollaboratorRole.VIEWER.value, False),
    ],
)
def test_collaborator_edit_matrix(db: Session, role: str, expected: bool):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    collab = _create_user(db, "c@t.com", role=UserRole.STANDARD.value)
    p = _product(db, owner, is_public=False)
    _add_collaborator(db, p, collab, role, owner)
    assert can_edit_product(collab, p) is expected


def test_viewer_collaborator_can_access_but_not_edit(db: Session):
    """Regression guard: viewer must read but never write."""
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    viewer = _create_user(db, "v@t.com", role=UserRole.STANDARD.value)
    p = _product(db, owner, is_public=False)
    _add_collaborator(db, p, viewer, CollaboratorRole.VIEWER.value, owner)
    assert can_access_product(viewer, p) is True
    assert can_edit_product(viewer, p) is False


# ── require_product_* wrappers ────────────────────────────────────────────────

def test_require_product_access_raises_for_stranger(db: Session):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    stranger = _create_user(db, "x@t.com", role=UserRole.STANDARD.value)
    p = _product(db, owner, is_public=False)
    with pytest.raises(PermissionDenied):
        require_product_access(stranger, p)


def test_require_product_edit_raises_for_viewer(db: Session):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    viewer = _create_user(db, "v@t.com", role=UserRole.STANDARD.value)
    p = _product(db, owner, is_public=False)
    _add_collaborator(db, p, viewer, CollaboratorRole.VIEWER.value, owner)
    with pytest.raises(PermissionDenied):
        require_product_edit(viewer, p)


def test_require_product_access_ok_for_owner(db: Session):
    owner = _create_user(db, "owner@t.com", role=UserRole.STANDARD.value)
    p = _product(db, owner)
    # Should not raise.
    require_product_access(owner, p)
    require_product_edit(owner, p)
