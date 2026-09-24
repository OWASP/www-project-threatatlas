# MCP server — connect AI assistants to ThreatAtlas

ThreatAtlas ships a built-in [MCP](https://modelcontextprotocol.io) (Model
Context Protocol) server so AI coding assistants and agents — Claude Code,
Claude.ai, Claude Desktop, or any other MCP client — can read and act on your
threat models directly, instead of you copy-pasting diagrams and threat
lists into a chat window.

Every tool call runs through the exact same router functions, RBAC checks,
and audit logging as the REST API and web UI, attributed to the token's
owning user. There is no elevated "AI" role — an assistant can only do what
the person who authorized it could do by hand in the browser.

---

## The endpoint

```
POST https://<your-threatatlas-instance>/mcp/
```

This uses the Streamable HTTP transport (note the trailing slash — it's
registered as an exact route, not a prefix). Most MCP clients only need this
one URL; discovery of the auth endpoints below happens automatically.

## Authenticating

Two ways to authenticate, so both interactive and headless/CI clients are covered:

### 1. OAuth 2.1 (recommended for interactive clients)

Point a client that supports MCP's OAuth flow (Claude.ai, Claude Desktop,
Claude Code) at the endpoint above. It discovers
`/.well-known/oauth-authorization-server` and
`/.well-known/oauth-protected-resource/mcp`, dynamically registers itself,
and opens your browser to a ThreatAtlas login/consent screen — styled the
same as the app's own login page, so it's clear you're still signing into
ThreatAtlas and not handing credentials to a third party. Approve the
request and the client receives a scoped access token; no copying tokens
around.

Access tokens are valid for 1 hour and refresh tokens for 30 days; compliant
clients refresh silently in the background.

### 2. Personal API token (headless clients / CI)

For clients that don't do OAuth, create a long-lived token under
**Settings → Integrations → API Tokens** and send it as a bearer token:

```
Authorization: Bearer ta_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

A JWT from a normal logged-in session works the same way. Treat either as a
long-lived credential — revoke it from the same screen if it's ever
compromised.

## Configuring a client

Most MCP clients accept a JSON config block like:

```json
{
  "mcpServers": {
    "threatatlas": {
      "url": "https://your-threatatlas-instance.example.com/mcp/"
    }
  }
}
```

For a client without OAuth support, pass the personal API token as a header instead:

```json
{
  "mcpServers": {
    "threatatlas": {
      "url": "https://your-threatatlas-instance.example.com/mcp/",
      "headers": { "Authorization": "Bearer ta_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

For Claude Code specifically, adding it is a one-liner:

```bash
claude mcp add --transport http threatatlas https://your-threatatlas-instance.example.com/mcp/
```

## Available tools

An assistant can do everything a human can do in the app: draw diagrams,
identify threats, manage mitigations, and measure risk — all through the
same routers, RBAC, and audit logging as the REST API and web UI.

### Products

| Tool | Description |
|---|---|
| `list_products()` | List products visible to the authenticated user |
| `get_product(product_id)` | Get a single product by ID |
| `create_product(name, description?, is_public?, status?, ...)` | Create a new product to hold diagrams and threat models |
| `update_product(product_id, name?, description?, status?, ...)` | Update a product's metadata |
| `delete_product(product_id)` | Delete a product — only the owner or an admin can do this |

### Diagrams

| Tool | Description |
|---|---|
| `list_diagrams(product_id?)` | List diagrams, optionally filtered by product |
| `get_diagram(diagram_id)` | Get a single diagram, including its full node/edge data |
| `create_diagram(product_id, name, description?, diagram_data?)` | Create a diagram — pass `diagram_data` (ReactFlow `nodes`/`edges` JSON) to draw it directly |
| `update_diagram(diagram_id, name?, description?, diagram_data?, version_comment?)` | Redraw a diagram by replacing its full `diagram_data` |
| `delete_diagram(diagram_id)` | Delete a diagram |

### Frameworks & models

| Tool | Description |
|---|---|
| `list_frameworks()` | List threat-modeling frameworks (e.g. STRIDE, LINDDUN) |
| `list_diagram_models(diagram_id)` | List the framework instances ("models") attached to a diagram |
| `create_diagram_model(diagram_id, framework_id, name, description?)` | Bind a diagram to a framework — required before identifying threats/mitigations |

### Threats

| Tool | Description |
|---|---|
| `list_diagram_threats(diagram_id)` | List threats identified on a diagram |
| `list_threats(framework_id?, is_custom?)` | Browse the knowledge-base threat catalog |
| `create_custom_threat(framework_id, name, description?, category?)` | Add a custom threat when nothing in the KB fits |
| `identify_threat_on_diagram(diagram_id, model_id, threat_id, element_id, element_type, likelihood?, impact?, status?, comments?)` | Identify a threat on a diagram element — set `likelihood`/`impact` (1-5) to measure its `risk_score`/`severity` |
| `update_diagram_threat(diagram_threat_id, status?, comments?, likelihood?, impact?, residual_likelihood?, residual_impact?, residual_comments?)` | Update status/comments, inherent risk, or a separate manual residual-risk assessment |
| `delete_diagram_threat(diagram_threat_id)` | Remove a threat from a diagram element |

### Mitigations

| Tool | Description |
|---|---|
| `list_diagram_mitigations(diagram_id)` | List mitigations attached to a diagram |
| `list_knowledge_base_mitigations(framework_id?)` | List mitigations in the knowledge base |
| `create_custom_mitigation(framework_id, name, description?, category?)` | Add a custom mitigation when nothing in the KB fits |
| `add_mitigation_to_diagram(diagram_id, model_id, mitigation_id, element_id, element_type, threat_id?, status?, comments?)` | Attach a mitigation to a diagram element, optionally tied to a threat |
| `update_diagram_mitigation_status(diagram_mitigation_id, status?, comments?)` | Update a diagram mitigation's status/comments |
| `remove_mitigation_from_diagram(diagram_mitigation_id)` | Remove a mitigation from a diagram element |

### Component templates

| Tool | Description |
|---|---|
| `list_component_templates(framework_id?)` | List canonical DFD element templates (process, external entity, data store, ...), each pre-linked to KB threats/mitigations |
| `apply_component_template(template_id, diagram_id, model_id, element_id, element_type?, threat_ids?, mitigation_ids?)` | Attach a template's threats and mitigations to one diagram element in a single atomic, idempotent call — the fastest way to draw an element and identify+mitigate its threats at once |

### Risk

| Tool | Description |
|---|---|
| `search_threatatlas(q)` | Search across products, diagrams, threats, and mitigations |
| `get_product_security_status(product_id, fail_on_critical?, fail_on_unmitigated_high?, min_mitigation_ratio?)` | Measure a product's overall risk posture — severity breakdown, mitigation ratio, and pass/fail verdict, same as the CI gate |

This makes prompts like *"open a Claude Code session with MCP wired up,
draw a diagram for the Payments API with an API gateway, service, and
database, apply the matching component templates, then tell me if it
passes our security gate"* work end-to-end without ever leaving your
editor.

## Self-hosting configuration

The MCP OAuth flow needs to know its own public origin — it's used as both
the OAuth issuer and the resource-server URL, and must exactly match the
address your MCP clients use to reach the server (RFC 8414 discovery
rejects a mismatched issuer). Set it in `backend/.env`:

```
BACKEND_BASE_URL=https://your-threatatlas-instance.example.com
```

This defaults to `http://localhost:8000`, which is fine for local dev but
**must** be updated to the real public origin before enabling MCP in
production — the same idea as `FRONTEND_URL`.

## Troubleshooting

- **Client can't discover the server / redirect loop during login** — check
  that `BACKEND_BASE_URL` matches the origin the client actually uses
  (including scheme and any reverse-proxy path rewriting).
- **`401` on every tool call** — the bearer token expired (1 hour for
  OAuth access tokens) or was revoked; re-authenticate or issue a new
  personal API token.
- **A tool call fails with a permission error** — this mirrors the REST
  API's RBAC exactly; the authenticated user doesn't have access to that
  product/diagram in the web UI either.
