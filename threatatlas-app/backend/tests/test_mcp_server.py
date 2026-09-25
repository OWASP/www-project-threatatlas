"""Tests for the ThreatAtlas MCP server mounted at /mcp.

Posts raw JSON-RPC to /mcp/ (Streamable HTTP, stateless + json_response, so no
initialize handshake is required — see app/mcp/server.py) using the same
JWT fixtures as the REST API tests, exercising: bearer-token auth rejection,
one successful tools/call per tool, and RBAC/product-ACL enforcement.
"""

import json

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Diagram, Framework, Mitigation, Model, Product, Threat, User
from app.models.enums import UserRole
from tests.conftest import _create_user, make_auth_headers, make_expired_token

MCP_HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


# ── JSON-RPC helpers ────────────────────────────────────────────────────────

def rpc_post(client: TestClient, headers: dict, body: dict):
    return client.post("/mcp/", headers={**headers, **MCP_HEADERS}, json=body)


def call_tool(client: TestClient, headers: dict, name: str, arguments: dict | None = None):
    resp = rpc_post(client, headers, {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments or {}},
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["result"]


def tool_value(result: dict):
    """FastMCP puts list-returning tools under structuredContent.result; a
    bare `dict` return type only produces a JSON-text content block."""
    if "structuredContent" in result:
        return result["structuredContent"]["result"]
    return json.loads(result["content"][0]["text"])


def tool_error_text(result: dict) -> str:
    assert result.get("isError") is True, result
    return result["content"][0]["text"]


# ── Fixture data helpers ────────────────────────────────────────────────────

def _create_product(db: Session, owner: User, name: str = "Test Product", is_public: bool = False) -> Product:
    product = Product(user_id=owner.id, name=name, description="desc", is_public=is_public)
    db.add(product)
    db.flush()
    return product


def _create_diagram(db: Session, product: Product, name: str = "Test Diagram") -> Diagram:
    diagram = Diagram(product_id=product.id, name=name, diagram_data={"nodes": [], "edges": []})
    db.add(diagram)
    db.flush()
    return diagram


def _create_framework(db: Session, name: str = "STRIDE") -> Framework:
    framework = Framework(name=name)
    db.add(framework)
    db.flush()
    return framework


def _create_model(db: Session, diagram: Diagram, framework: Framework, name: str = "Analysis") -> Model:
    model = Model(diagram_id=diagram.id, framework_id=framework.id, name=name)
    db.add(model)
    db.flush()
    return model


def _create_threat(db: Session, framework: Framework, name: str = "Spoofing") -> Threat:
    threat = Threat(framework_id=framework.id, name=name)
    db.add(threat)
    db.flush()
    return threat


def _create_mitigation(db: Session, framework: Framework, name: str = "Input validation") -> Mitigation:
    mitigation = Mitigation(framework_id=framework.id, name=name)
    db.add(mitigation)
    db.flush()
    return mitigation


def _full_fixture_set(db: Session, owner: User):
    """A product + diagram + model + framework threat/mitigation, ready to
    attach a diagram threat/mitigation to."""
    product = _create_product(db, owner)
    diagram = _create_diagram(db, product)
    framework = _create_framework(db)
    model = _create_model(db, diagram, framework)
    threat = _create_threat(db, framework)
    mitigation = _create_mitigation(db, framework)
    return product, diagram, model, threat, mitigation


# ── Auth rejection ──────────────────────────────────────────────────────────

def _assert_invalid_token_response(resp):
    """The SDK's RequireAuthMiddleware collapses missing/garbage/expired
    tokens to the same 401 shape — see mcp/server/auth/middleware/bearer_auth.py."""
    assert resp.status_code == 401
    assert resp.json() == {"error": "invalid_token", "error_description": "Authentication required"}
    www_authenticate = resp.headers["www-authenticate"]
    assert www_authenticate.startswith("Bearer ")
    assert 'error="invalid_token"' in www_authenticate
    assert 'error_description="Authentication required"' in www_authenticate
    assert 'resource_metadata="' in www_authenticate


def test_no_token_rejected(client: TestClient):
    resp = rpc_post(client, {}, {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}})
    _assert_invalid_token_response(resp)


def test_garbage_token_rejected(client: TestClient):
    resp = rpc_post(client, {"Authorization": "Bearer garbage"}, {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}})
    _assert_invalid_token_response(resp)


def test_expired_token_rejected(client: TestClient, standard_user: User):
    headers = {"Authorization": f"Bearer {make_expired_token(standard_user)}"}
    resp = rpc_post(client, headers, {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}})
    _assert_invalid_token_response(resp)


def test_valid_token_lists_all_tools(client: TestClient, admin_headers: dict):
    resp = rpc_post(client, admin_headers, {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}})
    assert resp.status_code == 200
    tools = resp.json()["result"]["tools"]
    assert {t["name"] for t in tools} == {
        "list_products",
        "get_product",
        "create_product",
        "update_product",
        "delete_product",
        "list_diagrams",
        "get_diagram",
        "create_diagram",
        "update_diagram",
        "delete_diagram",
        "list_diagram_threats",
        "list_diagram_mitigations",
        "search_threatatlas",
        "list_frameworks",
        "list_diagram_models",
        "create_diagram_model",
        "list_knowledge_base_mitigations",
        "list_threats",
        "create_custom_threat",
        "identify_threat_on_diagram",
        "update_diagram_threat",
        "delete_diagram_threat",
        "add_mitigation_to_diagram",
        "update_diagram_mitigation_status",
        "create_custom_mitigation",
        "remove_mitigation_from_diagram",
        "list_component_templates",
        "apply_component_template",
        "get_product_security_status",
    }


def test_diagram_tools_advertise_supported_nodes_and_edge_handles(client: TestClient, admin_headers: dict):
    resp = rpc_post(
        client,
        admin_headers,
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
    )
    assert resp.status_code == 200
    tools = resp.json()["result"]["tools"]

    for tool_name in ("create_diagram", "update_diagram"):
        tool = next(tool for tool in tools if tool["name"] == tool_name)
        schema = tool["inputSchema"]
        node_schema = schema["$defs"]["MCPDiagramNode"]
        node_data_schema = schema["$defs"]["MCPDiagramNodeData"]
        edge_schema = schema["$defs"]["MCPDiagramEdge"]
        assert node_schema["properties"]["type"]["const"] == "custom"
        assert node_data_schema["properties"]["type"]["enum"] == [
            "process", "datastore", "external", "boundary",
        ]
        assert edge_schema["properties"]["sourceHandle"]["enum"] == [
            "source-top", "source-right", "source-bottom", "source-left",
        ]
        assert edge_schema["properties"]["targetHandle"]["enum"] == [
            "target-top", "target-right", "target-bottom", "target-left",
        ]
        assert {"sourceHandle", "targetHandle"} <= set(edge_schema["required"])
        assert "pair source-right with target-left" in edge_schema["properties"]["targetHandle"]["description"]


# ── Read tools ──────────────────────────────────────────────────────────────

def test_list_products(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _create_product(db, standard_user, "My Product")
    result = call_tool(client, user_headers, "list_products")
    names = [p["name"] for p in tool_value(result)]
    assert "My Product" in names


def test_list_products_hides_others(client: TestClient, standard_user: User, other_user: User, user_headers: dict, db: Session):
    _create_product(db, other_user, "Secret Product")
    result = call_tool(client, user_headers, "list_products")
    names = [p["name"] for p in tool_value(result)]
    assert "Secret Product" not in names


# ── Product management ───────────────────────────────────────────────────────

def test_get_product(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user, "My Product")
    result = call_tool(client, user_headers, "get_product", {"product_id": product.id})
    assert tool_value(result)["name"] == "My Product"


def test_get_product_not_found(client: TestClient, user_headers: dict):
    result = call_tool(client, user_headers, "get_product", {"product_id": 999999})
    assert "404" in tool_error_text(result)


def test_get_product_forbidden_for_other_user(client: TestClient, standard_user: User, other_user: User, db: Session):
    product = _create_product(db, standard_user)
    result = call_tool(client, make_auth_headers(other_user), "get_product", {"product_id": product.id})
    assert "403" in tool_error_text(result)


def test_create_product(client: TestClient, user_headers: dict):
    result = call_tool(client, user_headers, "create_product", {
        "name": "New Product",
        "description": "created via mcp",
        "status": "design",
    })
    created = tool_value(result)
    assert created["name"] == "New Product"
    assert created["status"] == "design"


def test_create_product_rejected_for_read_only(client: TestClient, db: Session):
    read_only_user = _create_user(db, "readonly3@test.com", role=UserRole.READ_ONLY.value)
    result = call_tool(client, make_auth_headers(read_only_user), "create_product", {"name": "Nope"})
    assert "403" in tool_error_text(result)


def test_update_product(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user, "Old Name")
    result = call_tool(client, user_headers, "update_product", {
        "product_id": product.id,
        "name": "Renamed Product",
    })
    updated = tool_value(result)
    assert updated["name"] == "Renamed Product"
    assert updated["description"] == "desc"


def test_update_product_rejected_for_other_user(client: TestClient, standard_user: User, other_user: User, db: Session):
    product = _create_product(db, standard_user)
    result = call_tool(client, make_auth_headers(other_user), "update_product", {
        "product_id": product.id,
        "name": "Hijacked",
    })
    assert "403" in tool_error_text(result)


def test_delete_product(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user)
    result = call_tool(client, user_headers, "delete_product", {"product_id": product.id})
    assert not result.get("isError")

    result = call_tool(client, user_headers, "get_product", {"product_id": product.id})
    assert "404" in tool_error_text(result)


def test_delete_product_rejected_for_editor_collaborator(client: TestClient, standard_user: User, other_user: User, db: Session):
    """Only the product owner or an admin can delete — even a collaborator
    with editor/owner-role access cannot, per products_router.delete_product."""
    product = _create_product(db, standard_user)
    from app.models.product_collaborator import ProductCollaborator
    db.add(ProductCollaborator(product_id=product.id, user_id=other_user.id, role="owner", added_by=standard_user.id))
    db.flush()

    result = call_tool(client, make_auth_headers(other_user), "delete_product", {"product_id": product.id})
    assert "403" in tool_error_text(result)


def test_list_diagrams_filtered_by_product(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user)
    diagram = _create_diagram(db, product)
    result = call_tool(client, user_headers, "list_diagrams", {"product_id": product.id})
    ids = [d["id"] for d in tool_value(result)]
    assert diagram.id in ids


def test_get_diagram(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user)
    diagram = _create_diagram(db, product, "My Diagram")
    result = call_tool(client, user_headers, "get_diagram", {"diagram_id": diagram.id})
    assert tool_value(result)["name"] == "My Diagram"


def test_get_diagram_not_found(client: TestClient, user_headers: dict):
    result = call_tool(client, user_headers, "get_diagram", {"diagram_id": 999999})
    assert "404" in tool_error_text(result)


def test_get_diagram_forbidden_for_other_user(client: TestClient, standard_user: User, other_user: User, db: Session):
    product = _create_product(db, standard_user)
    diagram = _create_diagram(db, product)
    result = call_tool(client, make_auth_headers(other_user), "get_diagram", {"diagram_id": diagram.id})
    assert "403" in tool_error_text(result)


def test_list_diagram_threats(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, threat, _mitigation = _full_fixture_set(db, standard_user)
    from app.models import DiagramThreat
    dt = DiagramThreat(diagram_id=diagram.id, model_id=model.id, threat_id=threat.id, element_id="n1", element_type="node")
    db.add(dt)
    db.flush()
    result = call_tool(client, user_headers, "list_diagram_threats", {"diagram_id": diagram.id})
    ids = [t["id"] for t in tool_value(result)]
    assert dt.id in ids


def test_list_diagram_mitigations(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, _threat, mitigation = _full_fixture_set(db, standard_user)
    from app.models import DiagramMitigation
    dm = DiagramMitigation(diagram_id=diagram.id, model_id=model.id, mitigation_id=mitigation.id, element_id="n1", element_type="node")
    db.add(dm)
    db.flush()
    result = call_tool(client, user_headers, "list_diagram_mitigations", {"diagram_id": diagram.id})
    ids = [m["id"] for m in tool_value(result)]
    assert dm.id in ids


def test_search_threatatlas(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _create_product(db, standard_user, "Findable Widget")
    result = call_tool(client, user_headers, "search_threatatlas", {"q": "Findable"})
    payload = tool_value(result)
    names = [p["name"] for p in payload["products"]]
    assert "Findable Widget" in names


def test_list_knowledge_base_mitigations(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    framework = _create_framework(db)
    _create_mitigation(db, framework, "Rate limiting")
    result = call_tool(client, user_headers, "list_knowledge_base_mitigations", {"framework_id": framework.id})
    names = [m["name"] for m in tool_value(result)]
    assert "Rate limiting" in names


# ── Write tools ─────────────────────────────────────────────────────────────

def test_add_mitigation_to_diagram(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, threat, mitigation = _full_fixture_set(db, standard_user)
    result = call_tool(client, user_headers, "add_mitigation_to_diagram", {
        "diagram_id": diagram.id,
        "model_id": model.id,
        "mitigation_id": mitigation.id,
        "element_id": "n1",
        "element_type": "node",
    })
    created = tool_value(result)
    assert created["diagram_id"] == diagram.id
    assert created["status"] == "proposed"


def test_add_mitigation_to_diagram_rejected_for_read_only(client: TestClient, standard_user: User, db: Session):
    product, diagram, model, threat, mitigation = _full_fixture_set(db, standard_user)
    read_only_user = _create_user(db, "readonly@test.com", role=UserRole.READ_ONLY.value)
    result = call_tool(client, make_auth_headers(read_only_user), "add_mitigation_to_diagram", {
        "diagram_id": diagram.id,
        "model_id": model.id,
        "mitigation_id": mitigation.id,
        "element_id": "n1",
        "element_type": "node",
    })
    assert "403" in tool_error_text(result)


def test_add_mitigation_to_diagram_rejected_for_unowned_product(client: TestClient, standard_user: User, other_user: User, db: Session):
    product, diagram, model, threat, mitigation = _full_fixture_set(db, standard_user)
    result = call_tool(client, make_auth_headers(other_user), "add_mitigation_to_diagram", {
        "diagram_id": diagram.id,
        "model_id": model.id,
        "mitigation_id": mitigation.id,
        "element_id": "n1",
        "element_type": "node",
    })
    assert "403" in tool_error_text(result)


def test_update_diagram_mitigation_status(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, _threat, mitigation = _full_fixture_set(db, standard_user)
    from app.models import DiagramMitigation
    dm = DiagramMitigation(diagram_id=diagram.id, model_id=model.id, mitigation_id=mitigation.id, element_id="n1", element_type="node")
    db.add(dm)
    db.flush()

    result = call_tool(client, user_headers, "update_diagram_mitigation_status", {
        "diagram_mitigation_id": dm.id,
        "status": "implemented",
    })
    updated = tool_value(result)
    assert updated["status"] == "implemented"


def test_update_diagram_mitigation_status_only_touches_given_field(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    """Regression guard for the _partial() helper: passing only `status`
    must not clear `comments` via exclude_unset=True semantics."""
    product, diagram, model, _threat, mitigation = _full_fixture_set(db, standard_user)
    from app.models import DiagramMitigation
    dm = DiagramMitigation(
        diagram_id=diagram.id, model_id=model.id, mitigation_id=mitigation.id,
        element_id="n1", element_type="node", comments="keep me",
    )
    db.add(dm)
    db.flush()

    result = call_tool(client, user_headers, "update_diagram_mitigation_status", {
        "diagram_mitigation_id": dm.id,
        "status": "implemented",
    })
    updated = tool_value(result)
    assert updated["comments"] == "keep me"


def test_update_diagram_threat(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, threat, _mitigation = _full_fixture_set(db, standard_user)
    from app.models import DiagramThreat
    dt = DiagramThreat(diagram_id=diagram.id, model_id=model.id, threat_id=threat.id, element_id="n1", element_type="node")
    db.add(dt)
    db.flush()

    result = call_tool(client, user_headers, "update_diagram_threat", {
        "diagram_threat_id": dt.id,
        "status": "mitigated",
        "comments": "fixed via input validation",
    })
    updated = tool_value(result)
    assert updated["status"] == "mitigated"
    assert updated["comments"] == "fixed via input validation"


def test_update_diagram_threat_measures_risk(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, threat, _mitigation = _full_fixture_set(db, standard_user)
    from app.models import DiagramThreat
    dt = DiagramThreat(diagram_id=diagram.id, model_id=model.id, threat_id=threat.id, element_id="n1", element_type="node")
    db.add(dt)
    db.flush()

    result = call_tool(client, user_headers, "update_diagram_threat", {
        "diagram_threat_id": dt.id,
        "likelihood": 4,
        "impact": 5,
    })
    updated = tool_value(result)
    assert updated["risk_score"] is not None
    assert updated["severity"] is not None


def test_update_diagram_threat_rejected_for_read_only(client: TestClient, standard_user: User, db: Session):
    product, diagram, model, threat, _mitigation = _full_fixture_set(db, standard_user)
    from app.models import DiagramThreat
    dt = DiagramThreat(diagram_id=diagram.id, model_id=model.id, threat_id=threat.id, element_id="n1", element_type="node")
    db.add(dt)
    db.flush()

    read_only_user = _create_user(db, "readonly2@test.com", role=UserRole.READ_ONLY.value)
    result = call_tool(client, make_auth_headers(read_only_user), "update_diagram_threat", {
        "diagram_threat_id": dt.id,
        "status": "mitigated",
    })
    assert "403" in tool_error_text(result)


# ── Drawing diagrams ─────────────────────────────────────────────────────────

def test_create_diagram_with_data(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user)
    graph = {
        "nodes": [
            {
                "id": "n1",
                "type": "custom",
                "position": {"x": 0, "y": 0},
                "data": {"label": "API", "type": "process"},
            },
            {
                "id": "n2",
                "type": "custom",
                "position": {"x": 300, "y": 0},
                "data": {"label": "Client", "type": "external"},
            }
        ],
        "edges": [
            {
                "id": "e1",
                "source": "n2",
                "target": "n1",
                "type": "custom",
                "sourceHandle": "source-left",
                "targetHandle": "target-right",
                "animated": True,
            }
        ],
    }
    result = call_tool(client, user_headers, "create_diagram", {
        "product_id": product.id,
        "name": "AI-drawn diagram",
        "diagram_data": graph,
    })
    created = tool_value(result)
    assert created["name"] == "AI-drawn diagram"
    assert created["diagram_data"] == graph


def test_create_diagram_rejects_plain_react_flow_node(
    client: TestClient,
    standard_user: User,
    user_headers: dict,
    db: Session,
):
    product = _create_product(db, standard_user)
    graph = {
        "nodes": [
            {
                "id": "n1",
                "type": "default",
                "position": {"x": 0, "y": 0},
                "data": {"label": "API", "type": "process"},
            }
        ],
        "edges": [],
    }
    result = call_tool(client, user_headers, "create_diagram", {
        "product_id": product.id,
        "name": "Invalid diagram",
        "diagram_data": graph,
    })
    error = tool_error_text(result)
    assert "diagram_data.nodes.0.type" in error
    assert "custom" in error


def test_create_diagram_requires_architecture_subtype(
    client: TestClient,
    standard_user: User,
    user_headers: dict,
    db: Session,
):
    product = _create_product(db, standard_user)
    graph = {
        "nodes": [
            {
                "id": "n1",
                "type": "custom",
                "position": {"x": 0, "y": 0},
                "data": {"label": "API"},
            }
        ],
        "edges": [],
    }
    result = call_tool(client, user_headers, "create_diagram", {
        "product_id": product.id,
        "name": "Invalid diagram",
        "diagram_data": graph,
    })
    assert "diagram_data.nodes.0.data.type" in tool_error_text(result)


def test_create_diagram_requires_edge_handles(
    client: TestClient,
    standard_user: User,
    user_headers: dict,
    db: Session,
):
    product = _create_product(db, standard_user)
    graph = {
        "nodes": [
            {
                "id": node_id,
                "type": "custom",
                "position": {"x": x, "y": 0},
                "data": {"label": node_id, "type": "process"},
            }
            for node_id, x in (("n1", 0), ("n2", 300))
        ],
        "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
    }
    result = call_tool(client, user_headers, "create_diagram", {
        "product_id": product.id,
        "name": "Invalid edge handles",
        "diagram_data": graph,
    })
    error = tool_error_text(result)
    assert "diagram_data.edges.0.sourceHandle" in error
    assert "diagram_data.edges.0.targetHandle" in error


def test_create_diagram_rejected_for_unowned_product(client: TestClient, standard_user: User, other_user: User, db: Session):
    product = _create_product(db, other_user)
    result = call_tool(client, make_auth_headers(standard_user), "create_diagram", {
        "product_id": product.id,
        "name": "Nope",
    })
    assert "403" in tool_error_text(result)


def test_update_diagram_redraws_data(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user)
    diagram = _create_diagram(db, product)
    graph = {
        "nodes": [
            {
                "id": "n1",
                "type": "custom",
                "position": {"x": 1, "y": 1},
                "data": {"label": "DB", "type": "datastore"},
            }
        ],
        "edges": [],
    }
    result = call_tool(client, user_headers, "update_diagram", {
        "diagram_id": diagram.id,
        "diagram_data": graph,
    })
    updated = tool_value(result)
    assert updated["diagram_data"] == graph


def test_delete_diagram(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user)
    diagram = _create_diagram(db, product)
    result = call_tool(client, user_headers, "delete_diagram", {"diagram_id": diagram.id})
    assert not result.get("isError")

    result = call_tool(client, user_headers, "get_diagram", {"diagram_id": diagram.id})
    assert "404" in tool_error_text(result)


# ── Frameworks & models ──────────────────────────────────────────────────────

def test_list_frameworks(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    _create_framework(db, "STRIDE")
    result = call_tool(client, user_headers, "list_frameworks")
    names = [f["name"] for f in tool_value(result)]
    assert "STRIDE" in names


def test_create_diagram_model(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product = _create_product(db, standard_user)
    diagram = _create_diagram(db, product)
    framework = _create_framework(db)
    result = call_tool(client, user_headers, "create_diagram_model", {
        "diagram_id": diagram.id,
        "framework_id": framework.id,
        "name": "Initial analysis",
    })
    created = tool_value(result)
    assert created["name"] == "Initial analysis"
    assert created["framework_name"] == framework.name

    result = call_tool(client, user_headers, "list_diagram_models", {"diagram_id": diagram.id})
    ids = [m["id"] for m in tool_value(result)]
    assert created["id"] in ids


# ── Identifying threats ──────────────────────────────────────────────────────

def test_list_threats_and_create_custom_threat(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    framework = _create_framework(db)
    _create_threat(db, framework, "Spoofing")
    result = call_tool(client, user_headers, "list_threats", {"framework_id": framework.id})
    names = [t["name"] for t in tool_value(result)]
    assert "Spoofing" in names

    result = call_tool(client, user_headers, "create_custom_threat", {
        "framework_id": framework.id,
        "name": "Custom SSRF",
        "category": "Tampering",
    })
    created = tool_value(result)
    assert created["name"] == "Custom SSRF"
    assert created["is_custom"] is True


def test_identify_threat_on_diagram_measures_risk(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, threat, _mitigation = _full_fixture_set(db, standard_user)
    result = call_tool(client, user_headers, "identify_threat_on_diagram", {
        "diagram_id": diagram.id,
        "model_id": model.id,
        "threat_id": threat.id,
        "element_id": "n1",
        "element_type": "node",
        "likelihood": 5,
        "impact": 5,
    })
    created = tool_value(result)
    assert created["status"] == "identified"
    assert created["risk_score"] is not None
    assert created["severity"] is not None


def test_delete_diagram_threat(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, threat, _mitigation = _full_fixture_set(db, standard_user)
    from app.models import DiagramThreat
    dt = DiagramThreat(diagram_id=diagram.id, model_id=model.id, threat_id=threat.id, element_id="n1", element_type="node")
    db.add(dt)
    db.flush()
    dt_id = dt.id

    result = call_tool(client, user_headers, "delete_diagram_threat", {"diagram_threat_id": dt_id})
    assert not result.get("isError")

    result = call_tool(client, user_headers, "list_diagram_threats", {"diagram_id": diagram.id})
    ids = [t["id"] for t in tool_value(result)]
    assert dt_id not in ids


# ── Mitigations ───────────────────────────────────────────────────────────────

def test_create_custom_mitigation(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    framework = _create_framework(db)
    result = call_tool(client, user_headers, "create_custom_mitigation", {
        "framework_id": framework.id,
        "name": "Custom rate limiting",
    })
    created = tool_value(result)
    assert created["name"] == "Custom rate limiting"
    assert created["is_custom"] is True


def test_remove_mitigation_from_diagram(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, _threat, mitigation = _full_fixture_set(db, standard_user)
    from app.models import DiagramMitigation
    dm = DiagramMitigation(diagram_id=diagram.id, model_id=model.id, mitigation_id=mitigation.id, element_id="n1", element_type="node")
    db.add(dm)
    db.flush()
    dm_id = dm.id

    result = call_tool(client, user_headers, "remove_mitigation_from_diagram", {"diagram_mitigation_id": dm_id})
    assert not result.get("isError")

    result = call_tool(client, user_headers, "list_diagram_mitigations", {"diagram_id": diagram.id})
    ids = [m["id"] for m in tool_value(result)]
    assert dm_id not in ids


# ── Component templates ──────────────────────────────────────────────────────

def _create_component_template(db: Session, threat: Threat | None = None, mitigation: Mitigation | None = None):
    from app.models.component_template import ComponentTemplate
    from app.models.component_template_link import ComponentTemplateMitigation, ComponentTemplateThreat

    template = ComponentTemplate(
        name="Redis Cache",
        slug=f"redis-cache-{id(threat)}-{id(mitigation)}",
        category="Databases",
        node_type="datastore",
        threats=[],
        mitigations=[],
    )
    db.add(template)
    db.flush()
    if threat is not None:
        db.add(ComponentTemplateThreat(component_id=template.id, threat_id=threat.id))
    if mitigation is not None:
        db.add(ComponentTemplateMitigation(component_id=template.id, mitigation_id=mitigation.id))
    db.flush()
    return template


def test_list_component_templates(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    framework = _create_framework(db)
    threat = _create_threat(db, framework)
    _create_component_template(db, threat=threat)
    result = call_tool(client, user_headers, "list_component_templates", {"framework_id": framework.id})
    groups = tool_value(result)
    all_names = [t["name"] for group in groups for t in group["components"]]
    assert "Redis Cache" in all_names


def test_apply_component_template(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, threat, mitigation = _full_fixture_set(db, standard_user)
    template = _create_component_template(db, threat=threat, mitigation=mitigation)

    result = call_tool(client, user_headers, "apply_component_template", {
        "template_id": template.id,
        "diagram_id": diagram.id,
        "model_id": model.id,
        "element_id": "n1",
    })
    applied = tool_value(result)
    assert applied["threats_added"] == 1
    assert applied["mitigations_added"] == 1

    # Re-applying is idempotent — everything is now skipped, not re-added.
    result = call_tool(client, user_headers, "apply_component_template", {
        "template_id": template.id,
        "diagram_id": diagram.id,
        "model_id": model.id,
        "element_id": "n1",
    })
    applied_again = tool_value(result)
    assert applied_again["threats_added"] == 0
    assert applied_again["threats_skipped"] == 1


# ── Measuring risk ───────────────────────────────────────────────────────────

def test_get_product_security_status(client: TestClient, standard_user: User, user_headers: dict, db: Session):
    product, diagram, model, threat, _mitigation = _full_fixture_set(db, standard_user)
    from app.models import DiagramThreat
    db.add(DiagramThreat(
        diagram_id=diagram.id, model_id=model.id, threat_id=threat.id,
        element_id="n1", element_type="node", likelihood=5, impact=5,
    ))
    db.flush()

    result = call_tool(client, user_headers, "get_product_security_status", {"product_id": product.id})
    payload = tool_value(result)
    assert payload["summary"]["total_threats"] == 1
    assert "pass" in payload


def test_get_product_security_status_rejected_for_unowned_product(client: TestClient, standard_user: User, other_user: User, db: Session):
    product = _create_product(db, other_user)
    result = call_tool(client, make_auth_headers(standard_user), "get_product_security_status", {"product_id": product.id})
    assert "403" in tool_error_text(result)
