"""ThreatAtlas MCP tools — v1 read/write surface for AI coding assistants.

Each tool calls the same router function the REST API uses, passing the
(user, db) resolved by the auth middleware for this request in place of
FastAPI's Depends() markers. RBAC, audit logging, and notifications all fire
exactly as they do for a normal web request, correctly attributed to the
token's owning user.
"""

from typing import Any, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.mcp.context import get_mcp_actor
from app.mcp.server import mcp
from app.routers import component_templates as component_templates_router
from app.routers import diagram_mitigations as diagram_mitigations_router
from app.routers import diagram_threats as diagram_threats_router
from app.routers import diagrams as diagrams_router
from app.routers import frameworks as frameworks_router
from app.routers import mitigations as mitigations_router
from app.routers import models as models_router
from app.routers import product_downloads as product_downloads_router
from app.routers import products as products_router
from app.routers import search as search_router
from app.routers import threats as threats_router
from app.routers.component_templates import ApplyTemplateRequest
from app.schemas import (
    Diagram,
    DiagramCreate,
    DiagramMitigation,
    DiagramMitigationCreate,
    DiagramMitigationUpdate,
    DiagramMitigationWithDetails,
    DiagramUpdate,
    Framework,
    Mitigation,
    MitigationCreate,
    Product,
    ProductCreate,
    ProductUpdate,
    Threat,
    ThreatCreate,
)
from app.schemas.model import ModelCreate, ModelWithFramework
from app.schemas.threat import DiagramThreat, DiagramThreatCreate, DiagramThreatUpdate


DiagramNodeSubtype = Literal["process", "datastore", "external", "boundary"]
DiagramSourceHandle = Literal["source-top", "source-right", "source-bottom", "source-left"]
DiagramTargetHandle = Literal["target-top", "target-right", "target-bottom", "target-left"]


class MCPDiagramPosition(BaseModel):
    """React Flow coordinates for a diagram node."""

    x: float
    y: float


class MCPDiagramNodeData(BaseModel):
    """ThreatAtlas-specific data rendered by the custom diagram node."""

    label: str
    type: DiagramNodeSubtype = Field(
        description="Architecture subtype: process, datastore, external, or boundary.",
    )

    model_config = ConfigDict(extra="allow")


class MCPDiagramNode(BaseModel):
    """A React Flow node using ThreatAtlas's custom architecture renderer."""

    id: str
    type: Literal["custom"] = Field(
        default="custom",
        description='React Flow renderer type. Must be "custom"; put the architecture subtype in data.type.',
    )
    position: MCPDiagramPosition
    data: MCPDiagramNodeData

    model_config = ConfigDict(extra="allow")


class MCPDiagramEdge(BaseModel):
    """A connection between explicit handles on two architecture nodes."""

    id: str
    source: str
    target: str
    type: Literal["custom"] = Field(
        default="custom",
        description='React Flow edge renderer type. Must be "custom".',
    )
    source_handle: DiagramSourceHandle = Field(
        alias="sourceHandle",
        description=(
            "Handle on the source node. Choose the side facing the target: for example, "
            "use source-right when the target is to the right."
        ),
    )
    target_handle: DiagramTargetHandle = Field(
        alias="targetHandle",
        description=(
            "Handle on the target node. Choose the side facing the source: for example, "
            "pair source-right with target-left."
        ),
    )

    model_config = ConfigDict(extra="allow", populate_by_name=True)


class MCPDiagramData(BaseModel):
    """Complete React Flow graph accepted by the MCP diagram tools."""

    nodes: list[MCPDiagramNode] = Field(default_factory=list)
    edges: list[MCPDiagramEdge] = Field(
        default_factory=list,
        description=(
            "Connections between explicit node handles. Select opposing handles from the "
            "nodes' relative positions (right/left, left/right, bottom/top, or top/bottom), "
            "and distribute multiple connections across suitable sides to reduce crossings."
        ),
    )

    model_config = ConfigDict(extra="allow")


def _call(fn, *args, **kwargs) -> Any:
    """Call a router function directly, translating HTTP errors (including
    RBAC's PermissionDenied, itself an HTTPException) into ValueErrors so
    FastMCP surfaces a clean message instead of a raw Starlette exception."""
    try:
        return fn(*args, **kwargs)
    except HTTPException as exc:
        raise ValueError(f"{exc.status_code}: {exc.detail}") from exc


def _dump(schema: type, obj: Any) -> dict:
    return schema.model_validate(obj).model_dump(mode="json")


def _dump_list(schema: type, objs: list) -> list[dict]:
    return [_dump(schema, obj) for obj in objs]


def _partial(model_cls: type, **kwargs) -> Any:
    """Build a pydantic model passing only the non-None kwargs, so fields the
    caller didn't specify stay unset — routers use model_dump(exclude_unset=True)
    for partial updates, so an explicit None here would wrongly clear a field."""
    return model_cls(**{k: v for k, v in kwargs.items() if v is not None})


@mcp.tool()
def list_products() -> list[dict]:
    """List products visible to the authenticated user."""
    actor = get_mcp_actor()
    products = _call(products_router.list_products, current_user=actor.user, db=actor.db)
    return _dump_list(Product, products)


@mcp.tool()
def get_product(product_id: int) -> dict:
    """Get a single product by ID."""
    actor = get_mcp_actor()
    product = _call(products_router.get_product, product_id=product_id, current_user=actor.user, db=actor.db)
    return _dump(Product, product)


@mcp.tool()
def create_product(
    name: str,
    description: str | None = None,
    is_public: bool = False,
    status: str | None = None,
    repository_url: str | None = None,
    confluence_url: str | None = None,
    application_url: str | None = None,
    business_area: str | None = None,
    owner_name: str | None = None,
    owner_email: str | None = None,
    jira_project_key: str | None = None,
    reviewer: str | None = None,
    contributors: str | None = None,
) -> dict:
    """Create a new product to hold diagrams and threat models.

    `status` is one of design/development/testing/deployment/production."""
    actor = get_mcp_actor()
    payload = ProductCreate(
        name=name,
        description=description,
        is_public=is_public,
        status=status,
        repository_url=repository_url,
        confluence_url=confluence_url,
        application_url=application_url,
        business_area=business_area,
        owner_name=owner_name,
        owner_email=owner_email,
        jira_project_key=jira_project_key,
        reviewer=reviewer,
        contributors=contributors,
    )
    created = _call(products_router.create_product, product=payload, current_user=actor.user, db=actor.db)
    return _dump(Product, created)


@mcp.tool()
def update_product(
    product_id: int,
    name: str | None = None,
    description: str | None = None,
    is_public: bool | None = None,
    status: str | None = None,
    repository_url: str | None = None,
    confluence_url: str | None = None,
    application_url: str | None = None,
    business_area: str | None = None,
    owner_name: str | None = None,
    owner_email: str | None = None,
    jira_project_key: str | None = None,
    reviewer: str | None = None,
    contributors: str | None = None,
) -> dict:
    """Update a product's metadata. Only the fields you pass are changed."""
    actor = get_mcp_actor()
    payload = _partial(
        ProductUpdate,
        name=name,
        description=description,
        is_public=is_public,
        status=status,
        repository_url=repository_url,
        confluence_url=confluence_url,
        application_url=application_url,
        business_area=business_area,
        owner_name=owner_name,
        owner_email=owner_email,
        jira_project_key=jira_project_key,
        reviewer=reviewer,
        contributors=contributors,
    )
    updated = _call(
        products_router.update_product,
        product_id=product_id,
        product=payload,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump(Product, updated)


@mcp.tool()
def delete_product(product_id: int) -> None:
    """Delete a product. Only the product owner or an admin can do this —
    collaborators cannot, even with owner-level collaborator access."""
    actor = get_mcp_actor()
    _call(products_router.delete_product, product_id=product_id, current_user=actor.user, db=actor.db)


@mcp.tool()
def list_diagrams(product_id: int | None = None) -> list[dict]:
    """List diagrams, optionally filtered by product_id."""
    actor = get_mcp_actor()
    diagrams = _call(
        diagrams_router.list_diagrams,
        current_user=actor.user,
        product_id=product_id,
        db=actor.db,
    )
    return _dump_list(Diagram, diagrams)


@mcp.tool()
def get_diagram(diagram_id: int) -> dict:
    """Get a single diagram by ID, including its full diagram_data (nodes/edges)."""
    actor = get_mcp_actor()
    diagram = _call(
        diagrams_router.get_diagram,
        diagram_id=diagram_id,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump(Diagram, diagram)


@mcp.tool()
def create_diagram(
    product_id: int,
    name: str,
    description: str | None = None,
    diagram_data: MCPDiagramData | None = None,
) -> dict:
    """Create a new diagram for a product.

    `diagram_data` is the complete React Flow graph. Every node uses the
    top-level renderer `type: "custom"` and must set `data.type` to exactly one
    of `process`, `datastore`, `external`, or `boundary`. Every edge must use
    `sourceHandle` and `targetHandle`; choose opposing sides based on node
    positions and distribute connections to keep the diagram readable. Pass
    the graph now or fill it in later via update_diagram."""
    actor = get_mcp_actor()
    payload = DiagramCreate(
        product_id=product_id,
        name=name,
        description=description,
        diagram_data=diagram_data.model_dump(mode="json", by_alias=True) if diagram_data is not None else None,
    )
    created = _call(diagrams_router.create_diagram, diagram=payload, current_user=actor.user, db=actor.db)
    return _dump(Diagram, created)


@mcp.tool()
def update_diagram(
    diagram_id: int,
    name: str | None = None,
    description: str | None = None,
    diagram_data: MCPDiagramData | None = None,
    version_comment: str | None = None,
) -> dict:
    """Update a diagram, including replacing its full diagram_data (nodes/edges).

    This is the core "draw via AI" tool: compute the complete React Flow graph
    and pass it as `diagram_data` to redraw the diagram. Every node uses
    top-level `type: "custom"`; its architecture subtype belongs in `data.type`
    and must be `process`, `datastore`, `external`, or `boundary`. Edges must
    name their `sourceHandle` and `targetHandle`; select opposing sides based on
    relative node positions and spread connections across suitable ports.
    Passing `version_comment` snapshots a version even if auto-versioning is
    off."""
    actor = get_mcp_actor()
    payload = _partial(
        DiagramUpdate,
        name=name,
        description=description,
        diagram_data=diagram_data.model_dump(mode="json", by_alias=True) if diagram_data is not None else None,
        version_comment=version_comment,
    )
    updated = _call(
        diagrams_router.update_diagram,
        diagram_id=diagram_id,
        diagram=payload,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump(Diagram, updated)


@mcp.tool()
def delete_diagram(diagram_id: int) -> None:
    """Delete a diagram."""
    actor = get_mcp_actor()
    _call(diagrams_router.delete_diagram, diagram_id=diagram_id, current_user=actor.user, db=actor.db)


@mcp.tool()
def list_diagram_threats(diagram_id: int) -> list[dict]:
    """List threats identified on a diagram."""
    actor = get_mcp_actor()
    threats = _call(
        diagram_threats_router.list_diagram_threats,
        diagram_id=diagram_id,
        current_user=actor.user,
        db=actor.db,
    )
    return [t.model_dump(mode="json") for t in threats]


@mcp.tool()
def list_diagram_mitigations(diagram_id: int) -> list[dict]:
    """List mitigations attached to a diagram."""
    actor = get_mcp_actor()
    mitigations = _call(
        diagram_mitigations_router.list_diagram_mitigations,
        diagram_id=diagram_id,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump_list(DiagramMitigationWithDetails, mitigations)


@mcp.tool()
def search_threatatlas(q: str) -> dict:
    """Search across products, diagrams, threats, and mitigations by name."""
    actor = get_mcp_actor()
    return _call(
        search_router.global_search,
        q=q,
        limit=20,
        current_user=actor.user,
        db=actor.db,
    )


@mcp.tool()
def list_frameworks() -> list[dict]:
    """List threat-modeling frameworks (e.g. STRIDE, LINDDUN) available to the user."""
    actor = get_mcp_actor()
    frameworks = _call(frameworks_router.list_frameworks, current_user=actor.user, db=actor.db)
    return _dump_list(Framework, frameworks)


@mcp.tool()
def list_diagram_models(diagram_id: int) -> list[dict]:
    """List the threat-modeling models (framework instances) attached to a diagram."""
    actor = get_mcp_actor()
    models = _call(
        models_router.list_diagram_models,
        diagram_id=diagram_id,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump_list(ModelWithFramework, models)


@mcp.tool()
def create_diagram_model(
    diagram_id: int,
    framework_id: int,
    name: str,
    description: str | None = None,
) -> dict:
    """Create a model binding a diagram to a threat-modeling framework.

    Required before identifying threats or mitigations on a diagram: threats
    and mitigations attach to a model_id, and the model determines which
    framework's threat/mitigation catalog is valid for that diagram."""
    actor = get_mcp_actor()
    payload = ModelCreate(
        diagram_id=diagram_id,
        framework_id=framework_id,
        name=name,
        description=description,
    )
    created = _call(models_router.create_model, model_data=payload, current_user=actor.user, db=actor.db)
    return _dump(ModelWithFramework, created)


@mcp.tool()
def list_knowledge_base_mitigations(framework_id: int | None = None) -> list[dict]:
    """List mitigations in the knowledge base, optionally filtered by framework_id."""
    actor = get_mcp_actor()
    mitigations = _call(
        mitigations_router.list_mitigations,
        framework_id=framework_id,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump_list(Mitigation, mitigations)


@mcp.tool()
def list_threats(framework_id: int | None = None, is_custom: bool | None = None) -> list[dict]:
    """List threats in the knowledge base, optionally filtered by framework_id/is_custom."""
    actor = get_mcp_actor()
    threats = _call(
        threats_router.list_threats,
        framework_id=framework_id,
        is_custom=is_custom,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump_list(Threat, threats)


@mcp.tool()
def create_custom_threat(
    framework_id: int,
    name: str,
    description: str | None = None,
    category: str | None = None,
) -> dict:
    """Create a custom threat in a framework's catalog, for when nothing in the knowledge base fits."""
    actor = get_mcp_actor()
    payload = ThreatCreate(framework_id=framework_id, name=name, description=description, category=category)
    created = _call(threats_router.create_threat, threat=payload, current_user=actor.user, db=actor.db)
    return _dump(Threat, created)


@mcp.tool()
def identify_threat_on_diagram(
    diagram_id: int,
    model_id: int,
    threat_id: int,
    element_id: str,
    element_type: str,
    likelihood: int | None = None,
    impact: int | None = None,
    status: str = "identified",
    comments: str | None = None,
) -> dict:
    """Identify a threat on a diagram element.

    `likelihood` and `impact` (1-5 each) drive automatic risk scoring — the
    response's `risk_score`/`severity` are computed server-side from them."""
    actor = get_mcp_actor()
    payload = DiagramThreatCreate(
        diagram_id=diagram_id,
        model_id=model_id,
        threat_id=threat_id,
        element_id=element_id,
        element_type=element_type,
        likelihood=likelihood,
        impact=impact,
        status=status,
        comments=comments,
    )
    created = _call(
        diagram_threats_router.create_diagram_threat,
        diagram_threat=payload,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump(DiagramThreat, created)


@mcp.tool()
def update_diagram_threat(
    diagram_threat_id: int,
    status: str | None = None,
    comments: str | None = None,
    likelihood: int | None = None,
    impact: int | None = None,
    residual_likelihood: int | None = None,
    residual_impact: int | None = None,
    residual_comments: str | None = None,
) -> dict:
    """Update a diagram threat's status/comments and/or risk assessments.

    Setting `likelihood`/`impact` (1-5 each) recalculates inherent risk.
    Residual risk is a separate manual reassessment after controls are in place;
    mitigation statuses do not alter either score. Acceptance/approval fields
    remain reserved for human approvers."""
    actor = get_mcp_actor()
    payload = _partial(
        DiagramThreatUpdate,
        status=status,
        comments=comments,
        likelihood=likelihood,
        impact=impact,
        residual_likelihood=residual_likelihood,
        residual_impact=residual_impact,
        residual_comments=residual_comments,
    )
    updated = _call(
        diagram_threats_router.update_diagram_threat,
        diagram_threat_id=diagram_threat_id,
        diagram_threat=payload,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump(DiagramThreat, updated)


@mcp.tool()
def delete_diagram_threat(diagram_threat_id: int) -> None:
    """Remove a threat from a diagram element."""
    actor = get_mcp_actor()
    _call(
        diagram_threats_router.delete_diagram_threat,
        diagram_threat_id=diagram_threat_id,
        current_user=actor.user,
        db=actor.db,
    )


@mcp.tool()
def add_mitigation_to_diagram(
    diagram_id: int,
    model_id: int,
    mitigation_id: int,
    element_id: str,
    element_type: str,
    threat_id: int | None = None,
    status: str = "proposed",
    comments: str | None = None,
) -> dict:
    """Attach a mitigation to a diagram element (optionally tied to a specific threat)."""
    actor = get_mcp_actor()
    payload = DiagramMitigationCreate(
        diagram_id=diagram_id,
        model_id=model_id,
        mitigation_id=mitigation_id,
        element_id=element_id,
        element_type=element_type,
        threat_id=threat_id,
        status=status,
        comments=comments,
    )
    created = _call(
        diagram_mitigations_router.create_diagram_mitigation,
        diagram_mitigation=payload,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump(DiagramMitigation, created)


@mcp.tool()
def update_diagram_mitigation_status(
    diagram_mitigation_id: int,
    status: str | None = None,
    comments: str | None = None,
) -> dict:
    """Update a diagram mitigation's status and/or comments."""
    actor = get_mcp_actor()
    payload = _partial(DiagramMitigationUpdate, status=status, comments=comments)
    updated = _call(
        diagram_mitigations_router.update_diagram_mitigation,
        diagram_mitigation_id=diagram_mitigation_id,
        diagram_mitigation=payload,
        current_user=actor.user,
        db=actor.db,
    )
    return _dump(DiagramMitigation, updated)


@mcp.tool()
def create_custom_mitigation(
    framework_id: int,
    name: str,
    description: str | None = None,
    category: str | None = None,
) -> dict:
    """Create a custom mitigation in a framework's catalog, for when nothing in the knowledge base fits."""
    actor = get_mcp_actor()
    payload = MitigationCreate(framework_id=framework_id, name=name, description=description, category=category)
    created = _call(mitigations_router.create_mitigation, mitigation=payload, current_user=actor.user, db=actor.db)
    return _dump(Mitigation, created)


@mcp.tool()
def remove_mitigation_from_diagram(diagram_mitigation_id: int) -> None:
    """Remove a mitigation from a diagram element."""
    actor = get_mcp_actor()
    _call(
        diagram_mitigations_router.delete_diagram_mitigation,
        diagram_mitigation_id=diagram_mitigation_id,
        current_user=actor.user,
        db=actor.db,
    )


@mcp.tool()
def list_component_templates(framework_id: int | None = None) -> list[dict]:
    """List canonical DFD component templates (process, external entity, data
    store, trust boundary, ...) grouped by category, each pre-linked to
    knowledge-base threats/mitigations. Use apply_component_template to draw
    and identify threats/mitigations for one in a single step."""
    actor = get_mcp_actor()
    grouped = _call(
        component_templates_router.list_component_templates,
        framework_id=framework_id,
        current_user=actor.user,
        db=actor.db,
    )
    return [g.model_dump(mode="json") for g in grouped]


@mcp.tool()
def apply_component_template(
    template_id: int,
    diagram_id: int,
    model_id: int,
    element_id: str,
    element_type: str = "node",
    threat_ids: list[int] | None = None,
    mitigation_ids: list[int] | None = None,
) -> dict:
    """Attach a component template's knowledge-base threats and mitigations to
    one diagram element in a single atomic call — the fastest way to draw a
    diagram element and identify+mitigate its threats in one step.

    Idempotent: items already attached are silently skipped. Omit
    threat_ids/mitigation_ids to apply everything the template links for the
    model's framework. Note: threats attached this way don't yet have
    likelihood/impact set, so risk_score/severity are null until a follow-up
    update_diagram_threat call sets them."""
    actor = get_mcp_actor()
    payload = ApplyTemplateRequest(
        diagram_id=diagram_id,
        model_id=model_id,
        element_id=element_id,
        element_type=element_type,
        threat_ids=threat_ids,
        mitigation_ids=mitigation_ids,
    )
    result = _call(
        component_templates_router.apply_template,
        template_id=template_id,
        payload=payload,
        current_user=actor.user,
        db=actor.db,
    )
    return result.model_dump(mode="json")


@mcp.tool()
def get_product_security_status(
    product_id: int,
    fail_on_critical: bool = False,
    fail_on_unmitigated_high: bool = False,
    min_mitigation_ratio: float | None = None,
) -> dict:
    """Measure a product's overall risk posture: severity breakdown and
    mitigation ratio across all its diagrams' threats, plus a pass/fail verdict
    against the given thresholds — the same check used to gate CI pipelines."""
    actor = get_mcp_actor()
    return _call(
        product_downloads_router.security_status,
        product_id=product_id,
        fail_on_critical=fail_on_critical,
        fail_on_unmitigated_high=fail_on_unmitigated_high,
        min_mitigation_ratio=min_mitigation_ratio,
        current_user=actor.user,
        db=actor.db,
    )
