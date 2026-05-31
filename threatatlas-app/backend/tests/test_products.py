"""Tests for product CRUD and role-based access control."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Product, User
from tests.conftest import _create_user, make_auth_headers


def _create_product(db: Session, owner: User, name: str = "Test Product", is_public: bool = False) -> Product:
    product = Product(user_id=owner.id, name=name, description="desc", is_public=is_public)
    db.add(product)
    db.flush()
    return product


# ── List products ──────────────────────────────────────────────────────────────

def test_list_products_returns_own(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _create_product(db, standard_user, "My Product")
    resp = client.get("/api/products/", headers=user_headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "My Product" in names


def test_list_products_hides_others(client: TestClient, standard_user: User, other_user: User, user_headers: dict, db: Session):
    _create_product(db, other_user, "Secret Product")
    resp = client.get("/api/products/", headers=user_headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "Secret Product" not in names


def test_list_products_admin_sees_all(client: TestClient, admin_user: User, standard_user: User, admin_headers: dict, db: Session):
    _create_product(db, standard_user, "User's Product")
    resp = client.get("/api/products/", headers=admin_headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "User's Product" in names


def test_list_products_public_visible_to_all(client: TestClient, standard_user: User, other_user: User, db: Session):
    _create_product(db, other_user, "Public Product", is_public=True)
    headers = make_auth_headers(standard_user)
    resp = client.get("/api/products/", headers=headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "Public Product" in names


# ── Create product ─────────────────────────────────────────────────────────────

def test_create_product(client: TestClient, user_headers: dict):
    resp = client.post("/api/products/", json={"name": "New Product"}, headers=user_headers)
    assert resp.status_code == 201
    assert resp.json()["name"] == "New Product"


def test_create_product_unauthenticated(client: TestClient):
    resp = client.post("/api/products/", json={"name": "Should Fail"})
    assert resp.status_code in (401, 403)


# ── Get single product ─────────────────────────────────────────────────────────

def test_get_product_by_owner(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user)
    resp = client.get(f"/api/products/{product.id}", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == product.id


def test_get_product_forbidden_for_other_user(client: TestClient, standard_user: User, other_user: User, db: Session):
    product = _create_product(db, standard_user)
    headers = make_auth_headers(other_user)
    resp = client.get(f"/api/products/{product.id}", headers=headers)
    assert resp.status_code == 403


def test_get_product_admin_can_access_any(client: TestClient, standard_user: User, admin_headers: dict, db: Session):
    product = _create_product(db, standard_user)
    resp = client.get(f"/api/products/{product.id}", headers=admin_headers)
    assert resp.status_code == 200


def test_get_nonexistent_product(client: TestClient, user_headers: dict):
    resp = client.get("/api/products/999999", headers=user_headers)
    assert resp.status_code == 404


# ── Update product ─────────────────────────────────────────────────────────────

def test_update_product_by_owner(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user, "Original")
    resp = client.put(f"/api/products/{product.id}", json={"name": "Updated"}, headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"


def test_update_product_forbidden_for_other_user(client: TestClient, standard_user: User, other_user: User, db: Session):
    product = _create_product(db, standard_user)
    headers = make_auth_headers(other_user)
    resp = client.put(f"/api/products/{product.id}", json={"name": "Hack"}, headers=headers)
    assert resp.status_code == 403


# ── Delete product ─────────────────────────────────────────────────────────────

def test_delete_product_by_owner(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user)
    resp = client.delete(f"/api/products/{product.id}", headers=user_headers)
    assert resp.status_code == 204


def test_delete_product_forbidden_for_other_user(client: TestClient, standard_user: User, other_user: User, db: Session):
    product = _create_product(db, standard_user)
    headers = make_auth_headers(other_user)
    resp = client.delete(f"/api/products/{product.id}", headers=headers)
    assert resp.status_code == 403
