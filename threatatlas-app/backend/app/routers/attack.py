"""MITRE ATT&CK technique catalog and threat→technique mapping.

The catalog is static bundled reference data; mappings from a user's diagram
threats to ATT&CK techniques are persisted so the threat model can express
"which adversary techniques does this threat correspond to".
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    DiagramThreat as DiagramThreatModel,
    DiagramThreatAttackTechnique,
    Diagram as DiagramModel,
    User as UserModel,
)
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_standard_or_admin, can_access_product, can_edit_product, PermissionDenied
from app.data.attack_techniques import (
    ATTACK_TECHNIQUES,
    TECHNIQUES_BY_ID,
    list_tactics,
    search_techniques,
)

router = APIRouter(prefix="/attack", tags=["attack"])


class AttachTechniqueRequest(BaseModel):
    technique_id: str


# ── Catalog (static reference data) ───────────────────────────────────────────

@router.get("/techniques")
def list_techniques(
    q: str | None = Query(default=None, description="Free-text filter on id/name/description"),
    tactic: str | None = Query(default=None, description="Filter by ATT&CK tactic"),
    current_user: UserModel = Depends(get_current_user),
):
    """Browse the bundled ATT&CK technique catalog."""
    return search_techniques(q=q, tactic=tactic)


@router.get("/tactics")
def list_attack_tactics(current_user: UserModel = Depends(get_current_user)):
    """Distinct ATT&CK tactics present in the catalog."""
    return list_tactics()


# ── Threat ↔ technique mappings ───────────────────────────────────────────────

def _load_diagram_threat(diagram_threat_id: int, db: Session) -> DiagramThreatModel:
    dt = (
        db.query(DiagramThreatModel)
        .options(joinedload(DiagramThreatModel.diagram).joinedload(DiagramModel.product))
        .filter(DiagramThreatModel.id == diagram_threat_id)
        .first()
    )
    if not dt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram threat not found")
    return dt


def _technique_payload(technique_id: str) -> dict:
    """Catalog entry for a stored mapping; tolerates ids no longer in the catalog."""
    return TECHNIQUES_BY_ID.get(technique_id, {"technique_id": technique_id, "name": technique_id, "tactic": None, "url": None, "description": None})


@router.get("/diagram-threats/{diagram_threat_id}/techniques")
def list_threat_techniques(
    diagram_threat_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List ATT&CK techniques mapped to a diagram threat."""
    dt = _load_diagram_threat(diagram_threat_id, db)
    if not can_access_product(current_user, dt.diagram.product):
        raise PermissionDenied("Not authorized to access this threat")
    links = (
        db.query(DiagramThreatAttackTechnique)
        .filter(DiagramThreatAttackTechnique.diagram_threat_id == diagram_threat_id)
        .all()
    )
    return [_technique_payload(link.technique_id) for link in links]


@router.post("/diagram-threats/{diagram_threat_id}/techniques", status_code=status.HTTP_201_CREATED)
def attach_threat_technique(
    diagram_threat_id: int,
    body: AttachTechniqueRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Map an ATT&CK technique to a diagram threat (idempotent)."""
    require_standard_or_admin(current_user)
    dt = _load_diagram_threat(diagram_threat_id, db)
    if not can_edit_product(current_user, dt.diagram.product):
        raise PermissionDenied("Not authorized to modify this threat")

    technique_id = body.technique_id.strip()
    if technique_id not in TECHNIQUES_BY_ID:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown ATT&CK technique '{technique_id}'")

    existing = (
        db.query(DiagramThreatAttackTechnique)
        .filter(
            DiagramThreatAttackTechnique.diagram_threat_id == diagram_threat_id,
            DiagramThreatAttackTechnique.technique_id == technique_id,
        )
        .first()
    )
    if existing:
        return _technique_payload(technique_id)

    db.add(DiagramThreatAttackTechnique(
        diagram_threat_id=diagram_threat_id,
        technique_id=technique_id,
        created_by=current_user.id,
    ))
    db.commit()
    return _technique_payload(technique_id)


@router.delete("/diagram-threats/{diagram_threat_id}/techniques/{technique_id}", status_code=status.HTTP_204_NO_CONTENT)
def detach_threat_technique(
    diagram_threat_id: int,
    technique_id: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove an ATT&CK technique mapping from a diagram threat."""
    require_standard_or_admin(current_user)
    dt = _load_diagram_threat(diagram_threat_id, db)
    if not can_edit_product(current_user, dt.diagram.product):
        raise PermissionDenied("Not authorized to modify this threat")

    link = (
        db.query(DiagramThreatAttackTechnique)
        .filter(
            DiagramThreatAttackTechnique.diagram_threat_id == diagram_threat_id,
            DiagramThreatAttackTechnique.technique_id == technique_id,
        )
        .first()
    )
    if link:
        db.delete(link)
        db.commit()
