"""Regression tests for effective product permissions on diagram surfaces."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Diagram, DiagramVersion, Product, ProductCollaborator, User
from app.models.enums import UserRole
from tests.conftest import _create_user, make_auth_headers


def _create_product(db: Session, owner: User, *, is_public: bool = False) -> Product:
    product = Product(user_id=owner.id, name="Permission Test", is_public=is_public)
    db.add(product)
    db.flush()
    return product


def _create_diagram(db: Session, product: Product, owner: User) -> Diagram:
    diagram = Diagram(
        product_id=product.id,
        created_by=owner.id,
        name="Main Diagram",
        diagram_data={"nodes": [], "edges": []},
        current_version=1,
    )
    db.add(diagram)
    db.flush()
    db.add(
        DiagramVersion(
            diagram_id=diagram.id,
            version_number=1,
            diagram_data=diagram.diagram_data,
            name=diagram.name,
        )
    )
    db.flush()
    return diagram


def test_owner_receives_edit_capability(
    client: TestClient, standard_user: User, user_headers: dict, db: Session
):
    product = _create_product(db, standard_user)
    diagram = _create_diagram(db, product, standard_user)

    product_response = client.get(f"/api/products/{product.id}", headers=user_headers)
    diagram_response = client.get(f"/api/diagrams/{diagram.id}", headers=user_headers)

    assert product_response.status_code == 200
    assert product_response.json()["can_edit"] is True
    assert diagram_response.status_code == 200
    assert diagram_response.json()["can_edit"] is True


def test_public_viewer_receives_read_only_capability(
    client: TestClient, standard_user: User, other_user: User, db: Session
):
    product = _create_product(db, standard_user, is_public=True)
    diagram = _create_diagram(db, product, standard_user)
    headers = make_auth_headers(other_user)

    product_response = client.get(f"/api/products/{product.id}", headers=headers)
    diagram_response = client.get(f"/api/diagrams/{diagram.id}", headers=headers)

    assert product_response.status_code == 200
    assert product_response.json()["can_edit"] is False
    assert diagram_response.status_code == 200
    assert diagram_response.json()["can_edit"] is False


def test_editor_and_viewer_collaborators_receive_distinct_capabilities(
    client: TestClient, standard_user: User, other_user: User, db: Session
):
    product = _create_product(db, standard_user)
    diagram = _create_diagram(db, product, standard_user)
    collaborator = ProductCollaborator(
        product_id=product.id,
        user_id=other_user.id,
        role="viewer",
        added_by=standard_user.id,
    )
    db.add(collaborator)
    db.flush()
    headers = make_auth_headers(other_user)

    viewer_response = client.get(f"/api/diagrams/{diagram.id}", headers=headers)
    assert viewer_response.status_code == 200
    assert viewer_response.json()["can_edit"] is False

    collaborator.role = "editor"
    db.flush()
    editor_response = client.get(f"/api/diagrams/{diagram.id}", headers=headers)
    assert editor_response.status_code == 200
    assert editor_response.json()["can_edit"] is True


def test_product_members_only_returns_eligible_approvers(
    client: TestClient,
    standard_user: User,
    other_user: User,
    admin_user: User,
    user_headers: dict,
    db: Session,
):
    product = _create_product(db, standard_user)
    viewer = _create_user(db, "viewer@test.com")
    read_only_editor = _create_user(db, "readonly-editor@test.com", role=UserRole.READ_ONLY.value)
    inactive_editor = _create_user(db, "inactive-editor@test.com")
    inactive_editor.is_active = False
    db.add_all([
        ProductCollaborator(
            product_id=product.id,
            user_id=other_user.id,
            role="editor",
            added_by=standard_user.id,
        ),
        ProductCollaborator(
            product_id=product.id,
            user_id=viewer.id,
            role="viewer",
            added_by=standard_user.id,
        ),
        ProductCollaborator(
            product_id=product.id,
            user_id=read_only_editor.id,
            role="editor",
            added_by=standard_user.id,
        ),
        ProductCollaborator(
            product_id=product.id,
            user_id=inactive_editor.id,
            role="editor",
            added_by=standard_user.id,
        ),
    ])
    db.flush()

    response = client.get(f"/api/products/{product.id}/members", headers=user_headers)

    assert response.status_code == 200
    returned_ids = {member["id"] for member in response.json()}
    assert returned_ids == {standard_user.id, other_user.id, admin_user.id}


def test_global_read_only_role_cannot_edit_owned_diagram(
    client: TestClient, db: Session
):
    read_only_owner = _create_user(db, "readonly-owner@test.com", role=UserRole.READ_ONLY.value)
    product = _create_product(db, read_only_owner)
    diagram = _create_diagram(db, product, read_only_owner)
    headers = make_auth_headers(read_only_owner)

    response = client.get(f"/api/diagrams/{diagram.id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["can_edit"] is False


def test_public_viewer_cannot_mutate_diagram_history(
    client: TestClient, standard_user: User, other_user: User, db: Session
):
    product = _create_product(db, standard_user, is_public=True)
    diagram = _create_diagram(db, product, standard_user)
    headers = make_auth_headers(other_user)

    assert client.get(
        f"/api/diagram-versions/{diagram.id}/versions/1", headers=headers
    ).status_code == 200
    assert client.post(
        f"/api/diagram-versions/{diagram.id}/versions",
        json={"comment": "viewer snapshot"},
        headers=headers,
    ).status_code == 403
    assert client.post(
        f"/api/diagram-versions/{diagram.id}/versions/1/restore", headers=headers
    ).status_code == 403
    assert client.delete(
        f"/api/diagram-versions/{diagram.id}/versions/1", headers=headers
    ).status_code == 403
