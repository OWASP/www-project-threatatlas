"""Best-effort audit logging helpers.

All public functions are intentionally non-raising — a logging failure must
never cause a 500 error for the caller.  Use ``db.flush()`` (not ``commit``)
so the event is included in the caller's existing transaction.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent


def log_event(
    db: Session,
    action: str,
    *,
    entity_type: str | None = None,
    entity_name: str | None = None,
    details: dict | None = None,
    product_id: int | None = None,
    diagram_id: int | None = None,
    user_id: int | None = None,
) -> None:
    """Insert an audit event into the current session.

    Uses ``flush`` (not ``commit``) so the event participates in the caller's
    transaction.  If anything goes wrong the exception is swallowed so callers
    are never disrupted.
    """
    try:
        # Use a nested transaction (SAVEPOINT) so a failure here rolls back
        # only the audit insert — never the caller's pending changes.
        with db.begin_nested():
            event = AuditEvent(
                action=action,
                entity_type=entity_type,
                entity_name=entity_name,
                details=details,
                product_id=product_id,
                diagram_id=diagram_id,
                user_id=user_id,
            )
            db.add(event)
    except Exception:
        pass
