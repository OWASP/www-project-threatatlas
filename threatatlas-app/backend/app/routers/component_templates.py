"""Component Threat Library — CRUD endpoints for ComponentTemplate.

Threats and mitigations are sourced from the Knowledge Base (single source of truth).
The pivot tables component_template_threats / component_template_mitigations link
each component to KB threat/mitigation IDs.  Pass ?framework_id=N to filter by framework.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.permissions import require_admin, require_standard_or_admin, can_edit_product, PermissionDenied
from app.database import get_db
from app.models import (
    ComponentTemplate,
    Diagram as DiagramModel,
    DiagramMitigation as DiagramMitigationModel,
    DiagramThreat as DiagramThreatModel,
    Model as ModelDB,
    User as UserModel,
)
from app.models.component_template_link import ComponentTemplateThreat, ComponentTemplateMitigation
from app.models.threat import Threat
from app.models.mitigation import Mitigation
from app.services.audit import log_event

router = APIRouter(prefix="/component-templates", tags=["component-templates"])


# ── Response schemas ──────────────────────────────────────────────────────────


class ComponentTemplateListItem(BaseModel):
    id: int
    name: str
    slug: str
    category: str
    node_type: str
    icon: Optional[str]
    description: Optional[str]
    threat_count: int
    is_custom: bool
    is_modified: bool = False

    model_config = {"from_attributes": True}


class KBThreatItem(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: str
    framework_id: int
    framework_name: str

class KBMitigationItem(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: str
    framework_id: int
    framework_name: str

class ComponentTemplateDetail(BaseModel):
    id: int
    name: str
    slug: str
    category: str
    node_type: str
    icon: Optional[str]
    description: Optional[str]
    # KB-linked threats/mitigations (filtered by framework_id if provided)
    threats: list[KBThreatItem]
    mitigations: list[KBMitigationItem]
    # Inline fallback (used when no KB links exist, e.g. newly created custom components)
    inline_threats: list[dict[str, Any]]
    inline_mitigations: list[dict[str, Any]]
    is_custom: bool
    is_modified: bool = False
    created_by: Optional[int]

    model_config = {"from_attributes": True}


class ComponentTemplateGrouped(BaseModel):
    category: str
    components: list[ComponentTemplateListItem]


# ── Request schemas ───────────────────────────────────────────────────────────


class ComponentTemplateCreate(BaseModel):
    name: str
    slug: str
    category: str
    node_type: str
    icon: Optional[str] = None
    description: Optional[str] = None
    # KB IDs — these create pivot-table links (single source of truth)
    threat_ids: list[int] = []
    mitigation_ids: list[int] = []


class ComponentTemplateUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    node_type: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    # Replaces ALL existing KB links when provided
    threat_ids: Optional[list[int]] = None
    mitigation_ids: Optional[list[int]] = None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _to_list_item(ct: ComponentTemplate, kb_threat_count: int | None = None) -> ComponentTemplateListItem:
    return ComponentTemplateListItem(
        id=ct.id,
        name=ct.name,
        slug=ct.slug,
        category=ct.category,
        node_type=ct.node_type,
        icon=ct.icon,
        description=ct.description,
        threat_count=kb_threat_count if kb_threat_count is not None else len(ct.threats or []),
        is_custom=ct.is_custom,
        is_modified=ct.is_modified,
    )


def _get_kb_threats(db: Session, component_id: int, framework_id: int | None) -> list[KBThreatItem]:
    from app.models.framework import Framework
    q = (
        db.query(Threat, Framework.name.label("framework_name"))
        .join(ComponentTemplateThreat, ComponentTemplateThreat.threat_id == Threat.id)
        .join(Framework, Framework.id == Threat.framework_id)
        .filter(ComponentTemplateThreat.component_id == component_id)
    )
    if framework_id:
        q = q.filter(Threat.framework_id == framework_id)
    return [
        KBThreatItem(id=t.id, name=t.name, description=t.description, category=t.category,
                     framework_id=t.framework_id, framework_name=fw_name)
        for t, fw_name in q.order_by(Threat.category, Threat.name).all()
    ]


def _get_kb_mitigations(db: Session, component_id: int, framework_id: int | None) -> list[KBMitigationItem]:
    from app.models.framework import Framework
    q = (
        db.query(Mitigation, Framework.name.label("framework_name"))
        .join(ComponentTemplateMitigation, ComponentTemplateMitigation.mitigation_id == Mitigation.id)
        .join(Framework, Framework.id == Mitigation.framework_id)
        .filter(ComponentTemplateMitigation.component_id == component_id)
    )
    if framework_id:
        q = q.filter(Mitigation.framework_id == framework_id)
    return [
        KBMitigationItem(id=m.id, name=m.name, description=m.description, category=m.category,
                         framework_id=m.framework_id, framework_name=fw_name)
        for m, fw_name in q.order_by(Mitigation.category, Mitigation.name).all()
    ]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/", response_model=list[ComponentTemplateGrouped])
def list_component_templates(
    framework_id: int | None = Query(default=None),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all component templates grouped by category.
    Pass ?framework_id=N to include only KB threat counts for that framework."""
    from sqlalchemy import func
    rows = (
        db.query(ComponentTemplate)
        .order_by(ComponentTemplate.category, ComponentTemplate.name)
        .all()
    )

    # Batch-count KB threat links (optionally filtered by framework)
    threat_count_q = (
        db.query(ComponentTemplateThreat.component_id, func.count(ComponentTemplateThreat.id).label("cnt"))
        .join(Threat, Threat.id == ComponentTemplateThreat.threat_id)
    )
    if framework_id:
        threat_count_q = threat_count_q.filter(Threat.framework_id == framework_id)
    kb_counts = {row.component_id: row.cnt for row in threat_count_q.group_by(ComponentTemplateThreat.component_id).all()}

    grouped: dict[str, list[ComponentTemplateListItem]] = {}
    for ct in rows:
        count = kb_counts.get(ct.id, len(ct.threats or []))
        grouped.setdefault(ct.category, []).append(_to_list_item(ct, count))

    return [
        ComponentTemplateGrouped(category=cat, components=items)
        for cat, items in sorted(grouped.items())
    ]


@router.get("/{template_id}", response_model=ComponentTemplateDetail)
def get_component_template(
    template_id: int,
    framework_id: int | None = Query(default=None, description="Filter KB threats/mitigations to this framework"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full detail. Pass ?framework_id=N to get KB threats for a specific framework."""
    ct = db.query(ComponentTemplate).filter(ComponentTemplate.id == template_id).first()
    if not ct:
        raise HTTPException(status_code=404, detail="Component template not found")

    kb_threats = _get_kb_threats(db, template_id, framework_id)
    kb_mits = _get_kb_mitigations(db, template_id, framework_id)

    return ComponentTemplateDetail(
        id=ct.id,
        name=ct.name,
        slug=ct.slug,
        category=ct.category,
        node_type=ct.node_type,
        icon=ct.icon,
        description=ct.description,
        threats=kb_threats,
        mitigations=kb_mits,
        inline_threats=ct.threats or [],
        inline_mitigations=ct.mitigations or [],
        is_custom=ct.is_custom,
        is_modified=ct.is_modified,
        created_by=ct.created_by,
    )


@router.post("/", response_model=ComponentTemplateDetail, status_code=status.HTTP_201_CREATED)
def create_component_template(
    payload: ComponentTemplateCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin only: create a custom component template."""
    require_admin(current_user)

    # Check slug uniqueness
    existing = db.query(ComponentTemplate).filter(ComponentTemplate.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Slug '{payload.slug}' is already in use")

    ct = ComponentTemplate(
        name=payload.name,
        slug=payload.slug,
        category=payload.category,
        node_type=payload.node_type,
        icon=payload.icon,
        description=payload.description,
        threats=[],
        mitigations=[],
        is_custom=True,
        created_by=current_user.id,
    )
    db.add(ct)
    db.flush()

    # Create KB pivot links
    for tid in set(payload.threat_ids):
        db.add(ComponentTemplateThreat(component_id=ct.id, threat_id=tid))
    for mid in set(payload.mitigation_ids):
        db.add(ComponentTemplateMitigation(component_id=ct.id, mitigation_id=mid))
    db.commit()
    db.refresh(ct)

    return ComponentTemplateDetail(
        id=ct.id,
        name=ct.name,
        slug=ct.slug,
        category=ct.category,
        node_type=ct.node_type,
        icon=ct.icon,
        description=ct.description,
        threats=_get_kb_threats(db, ct.id, None),
        mitigations=_get_kb_mitigations(db, ct.id, None),
        inline_threats=[],
        inline_mitigations=[],
        is_custom=ct.is_custom,
        created_by=ct.created_by,
    )


@router.put("/{template_id}", response_model=ComponentTemplateDetail)
def update_component_template(
    template_id: int,
    payload: ComponentTemplateUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin only: update a custom component template."""
    require_admin(current_user)

    ct = db.query(ComponentTemplate).filter(ComponentTemplate.id == template_id).first()
    if not ct:
        raise HTTPException(status_code=404, detail="Component template not found")

    # Snapshot originals on first edit of a predefined (system) template
    if not ct.is_custom and not ct.is_modified:
        ct.original_name = ct.name
        ct.original_description = ct.description
        ct.original_category = ct.category
        ct.original_node_type = ct.node_type
        ct.original_icon = ct.icon
        # Snapshot current KB links
        ct.original_threat_ids = [
            row.threat_id for row in
            db.query(ComponentTemplateThreat).filter(ComponentTemplateThreat.component_id == template_id).all()
        ]
        ct.original_mitigation_ids = [
            row.mitigation_id for row in
            db.query(ComponentTemplateMitigation).filter(ComponentTemplateMitigation.component_id == template_id).all()
        ]
        ct.is_modified = True

    # Apply partial updates
    if payload.name is not None:
        ct.name = payload.name
    if payload.slug is not None:
        conflict = (
            db.query(ComponentTemplate)
            .filter(ComponentTemplate.slug == payload.slug, ComponentTemplate.id != template_id)
            .first()
        )
        if conflict:
            raise HTTPException(status_code=409, detail=f"Slug '{payload.slug}' is already in use")
        ct.slug = payload.slug
    if payload.category is not None:
        ct.category = payload.category
    if payload.node_type is not None:
        ct.node_type = payload.node_type
    if payload.icon is not None:
        ct.icon = payload.icon
    if payload.description is not None:
        ct.description = payload.description

    # Replace KB links when IDs are provided
    if payload.threat_ids is not None:
        db.query(ComponentTemplateThreat).filter(ComponentTemplateThreat.component_id == template_id).delete()
        for tid in set(payload.threat_ids):
            db.add(ComponentTemplateThreat(component_id=template_id, threat_id=tid))
    if payload.mitigation_ids is not None:
        db.query(ComponentTemplateMitigation).filter(ComponentTemplateMitigation.component_id == template_id).delete()
        for mid in set(payload.mitigation_ids):
            db.add(ComponentTemplateMitigation(component_id=template_id, mitigation_id=mid))

    db.commit()
    db.refresh(ct)

    return ComponentTemplateDetail(
        id=ct.id,
        name=ct.name,
        slug=ct.slug,
        category=ct.category,
        node_type=ct.node_type,
        icon=ct.icon,
        description=ct.description,
        threats=_get_kb_threats(db, ct.id, None),
        mitigations=_get_kb_mitigations(db, ct.id, None),
        inline_threats=ct.threats or [],
        inline_mitigations=ct.mitigations or [],
        is_custom=ct.is_custom,
        is_modified=ct.is_modified,
        created_by=ct.created_by,
    )


@router.post("/{template_id}/revert", response_model=ComponentTemplateDetail)
def revert_component_template(
    template_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin only: revert a modified predefined component template back to its original state."""
    require_admin(current_user)
    ct = db.query(ComponentTemplate).filter(ComponentTemplate.id == template_id).first()
    if not ct:
        raise HTTPException(status_code=404, detail="Component template not found")
    if ct.is_custom:
        raise HTTPException(status_code=400, detail="Custom components cannot be reverted. Delete instead.")
    if not ct.is_modified:
        raise HTTPException(status_code=400, detail="This component has not been modified.")
    if ct.original_name is None:
        raise HTTPException(status_code=400, detail="Cannot revert: original snapshot is missing.")

    # Restore metadata
    ct.name = ct.original_name
    ct.description = ct.original_description
    ct.category = ct.original_category
    ct.node_type = ct.original_node_type
    ct.icon = ct.original_icon

    # Restore KB links
    db.query(ComponentTemplateThreat).filter(ComponentTemplateThreat.component_id == template_id).delete()
    for tid in (ct.original_threat_ids or []):
        db.add(ComponentTemplateThreat(component_id=template_id, threat_id=tid))
    db.query(ComponentTemplateMitigation).filter(ComponentTemplateMitigation.component_id == template_id).delete()
    for mid in (ct.original_mitigation_ids or []):
        db.add(ComponentTemplateMitigation(component_id=template_id, mitigation_id=mid))

    # Clear snapshot
    ct.is_modified = False
    ct.original_name = None
    ct.original_description = None
    ct.original_category = None
    ct.original_node_type = None
    ct.original_icon = None
    ct.original_threat_ids = None
    ct.original_mitigation_ids = None

    db.commit()
    db.refresh(ct)
    return ComponentTemplateDetail(
        id=ct.id, name=ct.name, slug=ct.slug, category=ct.category,
        node_type=ct.node_type, icon=ct.icon, description=ct.description,
        threats=_get_kb_threats(db, ct.id, None),
        mitigations=_get_kb_mitigations(db, ct.id, None),
        inline_threats=[], inline_mitigations=[],
        is_custom=ct.is_custom, is_modified=ct.is_modified, created_by=ct.created_by,
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_component_template(
    template_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin only: delete a custom component template (cannot delete system templates)."""
    require_admin(current_user)

    ct = db.query(ComponentTemplate).filter(ComponentTemplate.id == template_id).first()
    if not ct:
        raise HTTPException(status_code=404, detail="Component template not found")

    if not ct.is_custom:
        raise HTTPException(
            status_code=403,
            detail="System templates cannot be deleted.",
        )

    db.delete(ct)
    db.commit()


# ── KB link management (admin) ─────────────────────────────────────────────────

class KBLinkPayload(BaseModel):
    threat_ids: list[int] = []
    mitigation_ids: list[int] = []


@router.post("/{template_id}/kb-links", status_code=status.HTTP_204_NO_CONTENT)
def add_kb_links(
    template_id: int,
    payload: KBLinkPayload,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin only: link KB threat/mitigation IDs to a component template."""
    require_admin(current_user)
    ct = db.query(ComponentTemplate).filter(ComponentTemplate.id == template_id).first()
    if not ct:
        raise HTTPException(status_code=404, detail="Component template not found")

    existing_t = {row.threat_id for row in db.query(ComponentTemplateThreat).filter(ComponentTemplateThreat.component_id == template_id).all()}
    existing_m = {row.mitigation_id for row in db.query(ComponentTemplateMitigation).filter(ComponentTemplateMitigation.component_id == template_id).all()}

    for tid in payload.threat_ids:
        if tid not in existing_t:
            db.add(ComponentTemplateThreat(component_id=template_id, threat_id=tid))
    for mid in payload.mitigation_ids:
        if mid not in existing_m:
            db.add(ComponentTemplateMitigation(component_id=template_id, mitigation_id=mid))
    db.commit()


@router.delete("/{template_id}/kb-links/threats/{threat_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_kb_threat_link(
    template_id: int, threat_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin only: unlink a KB threat from a component template."""
    require_admin(current_user)
    row = db.query(ComponentTemplateThreat).filter(
        ComponentTemplateThreat.component_id == template_id,
        ComponentTemplateThreat.threat_id == threat_id,
    ).first()
    if row:
        db.delete(row)
        db.commit()


@router.delete("/{template_id}/kb-links/mitigations/{mitigation_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_kb_mitigation_link(
    template_id: int, mitigation_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin only: unlink a KB mitigation from a component template."""
    require_admin(current_user)
    row = db.query(ComponentTemplateMitigation).filter(
        ComponentTemplateMitigation.component_id == template_id,
        ComponentTemplateMitigation.mitigation_id == mitigation_id,
    ).first()
    if row:
        db.delete(row)
        db.commit()


# ── KB browse endpoints (for form population) ─────────────────────────────────

class ApplyTemplateRequest(BaseModel):
    """Instantiate a component template's threats/mitigations onto a diagram element."""
    diagram_id: int
    model_id: int
    element_id: str
    element_type: str = "node"
    # If omitted, every framework-matching linked threat/mitigation is applied.
    threat_ids: Optional[list[int]] = None
    mitigation_ids: Optional[list[int]] = None


class ApplyTemplateResult(BaseModel):
    threats_added: int
    mitigations_added: int
    threats_skipped: int
    mitigations_skipped: int


@router.post("/{template_id}/apply", response_model=ApplyTemplateResult)
def apply_template(
    template_id: int,
    payload: ApplyTemplateRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach a component template's KB threats and mitigations to one diagram
    element in a single transaction.

    Replaces the previous per-item client loop: this is atomic (all-or-nothing),
    enforces the model's framework, and silently skips items already attached so
    re-applying a template is idempotent.
    """
    require_standard_or_admin(current_user)

    template = db.query(ComponentTemplate).filter(ComponentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Component template not found")

    diagram = db.query(DiagramModel).filter(DiagramModel.id == payload.diagram_id).first()
    if not diagram:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagram not found")
    if not can_edit_product(current_user, diagram.product):
        raise PermissionDenied("Not authorized to modify this diagram")

    model = db.query(ModelDB).filter(ModelDB.id == payload.model_id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    if model.diagram_id != payload.diagram_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Model does not belong to this diagram")

    # Resolve the template's linked KB ids, scoped to the model's framework.
    linked_threat_ids = {
        row.threat_id
        for row in db.query(ComponentTemplateThreat).filter(ComponentTemplateThreat.component_id == template_id).all()
    }
    linked_mit_ids = {
        row.mitigation_id
        for row in db.query(ComponentTemplateMitigation).filter(ComponentTemplateMitigation.component_id == template_id).all()
    }
    if payload.threat_ids is not None:
        linked_threat_ids &= set(payload.threat_ids)
    if payload.mitigation_ids is not None:
        linked_mit_ids &= set(payload.mitigation_ids)

    # Only items in the model's framework are applicable.
    applicable_threats = (
        db.query(Threat).filter(Threat.id.in_(linked_threat_ids), Threat.framework_id == model.framework_id).all()
        if linked_threat_ids else []
    )
    applicable_mits = (
        db.query(Mitigation).filter(Mitigation.id.in_(linked_mit_ids), Mitigation.framework_id == model.framework_id).all()
        if linked_mit_ids else []
    )

    threats_added = threats_skipped = 0
    mitigations_added = mitigations_skipped = 0

    for threat in applicable_threats:
        exists = db.query(DiagramThreatModel).filter(
            DiagramThreatModel.model_id == payload.model_id,
            DiagramThreatModel.threat_id == threat.id,
            DiagramThreatModel.element_id == payload.element_id,
        ).first()
        if exists:
            threats_skipped += 1
            continue
        db.add(DiagramThreatModel(
            diagram_id=payload.diagram_id,
            model_id=payload.model_id,
            threat_id=threat.id,
            element_id=payload.element_id,
            element_type=payload.element_type,
            status="identified",
        ))
        threats_added += 1

    for mitigation in applicable_mits:
        exists = db.query(DiagramMitigationModel).filter(
            DiagramMitigationModel.model_id == payload.model_id,
            DiagramMitigationModel.mitigation_id == mitigation.id,
            DiagramMitigationModel.element_id == payload.element_id,
            DiagramMitigationModel.threat_id.is_(None),
        ).first()
        if exists:
            mitigations_skipped += 1
            continue
        db.add(DiagramMitigationModel(
            diagram_id=payload.diagram_id,
            model_id=payload.model_id,
            mitigation_id=mitigation.id,
            element_id=payload.element_id,
            element_type=payload.element_type,
            status="proposed",
        ))
        mitigations_added += 1

    log_event(
        db,
        action="component_template_applied",
        entity_type="component_template",
        entity_name=template.name,
        details={
            "template_id": template_id,
            "element_id": payload.element_id,
            "threats_added": threats_added,
            "mitigations_added": mitigations_added,
        },
        product_id=diagram.product_id,
        diagram_id=payload.diagram_id,
        user_id=current_user.id,
    )
    db.commit()

    return ApplyTemplateResult(
        threats_added=threats_added,
        mitigations_added=mitigations_added,
        threats_skipped=threats_skipped,
        mitigations_skipped=mitigations_skipped,
    )


@router.get("/kb/frameworks", response_model=list[dict])
def list_frameworks_for_components(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all frameworks with their threat+mitigation counts for the component form."""
    from app.models.framework import Framework
    from sqlalchemy import func
    rows = (
        db.query(Framework.id, Framework.name, func.count(Threat.id).label("threat_count"))
        .outerjoin(Threat, Threat.framework_id == Framework.id)
        .group_by(Framework.id, Framework.name)
        .order_by(Framework.name)
        .all()
    )
    return [{"id": r.id, "name": r.name, "threat_count": r.threat_count} for r in rows]


@router.get("/kb/threats", response_model=list[dict])
def list_kb_threats_for_framework(
    framework_id: int = Query(...),
    q: str = Query(default=""),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return KB threats for a framework, optionally filtered by search query."""
    query = db.query(Threat).filter(Threat.framework_id == framework_id)
    if q:
        query = query.filter(Threat.name.ilike(f"%{q}%"))
    threats = query.order_by(Threat.category, Threat.name).all()
    return [{"id": t.id, "name": t.name, "category": t.category, "description": t.description} for t in threats]


@router.get("/kb/mitigations", response_model=list[dict])
def list_kb_mitigations_for_framework(
    framework_id: int = Query(...),
    q: str = Query(default=""),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return KB mitigations for a framework, optionally filtered by search query."""
    query = db.query(Mitigation).filter(Mitigation.framework_id == framework_id)
    if q:
        query = query.filter(Mitigation.name.ilike(f"%{q}%"))
    mits = query.order_by(Mitigation.category, Mitigation.name).all()
    return [{"id": m.id, "name": m.name, "category": m.category, "description": m.description} for m in mits]
