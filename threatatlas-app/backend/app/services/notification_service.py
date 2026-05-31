"""Best-effort in-app notification helpers.

All public functions are intentionally non-raising — a notification failure
must never cause a 500 error for the caller.
"""

from __future__ import annotations

from sqlalchemy.orm import Session, joinedload

from app.models.notification import Notification
from app.models.product import Product
from app.models.product_collaborator import ProductCollaborator


def create_notification(
    db: Session,
    user_id: int,
    type_: str,
    title: str,
    message: str,
    link: str | None = None,
) -> None:
    """Create an in-app notification. Best-effort, never raises."""
    try:
        n = Notification(
            user_id=user_id,
            type=type_,
            title=title,
            message=message,
            link=link,
        )
        db.add(n)
        db.flush()
    except Exception:
        pass


def notify_threat_added(
    db: Session,
    threat_name: str,
    diagram_name: str,
    product: Product,
    excluding_user_id: int | None = None,
) -> None:
    """Notify all product members (owner + editors) when a threat is added."""
    try:
        recipient_ids: set[int] = set()

        # Add the product owner
        if product.user_id and product.user_id != excluding_user_id:
            recipient_ids.add(product.user_id)

        # Add editor collaborators
        collaborators = (
            db.query(ProductCollaborator)
            .filter(
                ProductCollaborator.product_id == product.id,
                ProductCollaborator.role.in_(["editor", "owner"]),
            )
            .all()
        )
        for collab in collaborators:
            if collab.user_id != excluding_user_id:
                recipient_ids.add(collab.user_id)

        title = f"New threat added to {diagram_name}"
        message = f"New threat '{threat_name}' added to {diagram_name} in {product.name}"
        link = f"/products/{product.id}"

        for uid in recipient_ids:
            create_notification(db, uid, "threat_added", title, message, link)
    except Exception:
        pass


def notify_approval_needed(
    db: Session,
    threat_name: str,
    product_name: str,
    diagram_name: str,
    approver_id: int,
    link: str,
) -> None:
    """Notify the approver that a new risk acceptance needs their review."""
    try:
        title = "Risk acceptance pending your review"
        message = f"Risk acceptance pending your review: '{threat_name}' in {product_name}"
        create_notification(db, approver_id, "approval_needed", title, message, link)
    except Exception:
        pass


def notify_approval_decided(
    db: Session,
    decided_by_name: str,
    status: str,
    threat_name: str,
    accepter_id: int,
    link: str,
) -> None:
    """Notify the person who accepted the risk of the approval decision."""
    try:
        verb = "approved" if status == "approved" else "rejected"
        title = f"Your risk acceptance was {verb}"
        message = f"Your risk acceptance for '{threat_name}' was {verb} by {decided_by_name}"
        create_notification(db, accepter_id, "approval_decided", title, message, link)
    except Exception:
        pass


def notify_invitation(
    db: Session,
    product_name: str,
    invitee_id: int,
    link: str,
) -> None:
    """Notify a user they were invited to collaborate on a product."""
    try:
        title = f"You were invited to collaborate on {product_name}"
        message = f"You were invited to collaborate on {product_name}"
        create_notification(db, invitee_id, "invitation", title, message, link)
    except Exception:
        pass
