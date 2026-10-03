from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import logging

from app.config import settings
from app.auth.rate_limit import limiter

# Configure logging to reduce verbosity
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
from app.routers import (
    auth,
    users,
    products,
    frameworks,
    diagrams,
    models,
    threats,
    mitigations,
    diagram_threats,
    diagram_mitigations,
    diagram_versions,
    invitations,
    collaborators,
    oidc_providers,
    ldap_providers,
    groups,
    scim_tokens,
    scim,
    product_downloads,
)
from app.routers import ai_config, ai_conversations
from app.routers import api_tokens
from app.routers import audit
from app.routers import collaboration
from app.routers import integrations
from app.routers import component_templates
from app.routers import search
from app.routers import analytics
from app.routers import attack
from app.routers import approvals
from app.routers import notifications
from app.routers import mcp_oauth_ui
from app.routers.scim import ScimError


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: seed knowledge base, start the MCP session manager.

    FastMCP's streamable_http_app() wires session_manager.run() into its own
    Starlette sub-app's lifespan, but Starlette does not propagate lifespan
    events into Mount()-ed sub-apps — so it's entered here instead, on the
    root app's lifespan, or every /mcp request fails with "Task group is not
    initialized."
    """
    from app.mcp.server import mcp
    from app.seed import seed_knowledge_base

    seed_knowledge_base()
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(mcp.session_manager.run())
        yield


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    debug=settings.debug,
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

# Interactive API reference rendered by Scalar (script loaded from its CDN).
_SCALAR_HTML = """<!doctype html>
<html>
  <head>
    <title>{title} — API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>"""


@app.get("/docs", include_in_schema=False)
async def api_reference() -> HTMLResponse:
    return HTMLResponse(_SCALAR_HTML.format(title=settings.api_title))


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Session middleware — required by Authlib to hold OIDC state/nonce
# between the authorize redirect and the callback.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    same_site="lax",
    https_only=not settings.debug,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Browsers only expose a small safelist of response headers to JS by
    # default; Content-Disposition is not on it, so download filenames were
    # lost and browsers fell back to a generic "download" + ".txt".
    expose_headers=["Content-Disposition"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(frameworks.router, prefix="/api")
app.include_router(diagrams.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(threats.router, prefix="/api")
app.include_router(mitigations.router, prefix="/api")
app.include_router(diagram_threats.router, prefix="/api")
app.include_router(diagram_mitigations.router, prefix="/api")
app.include_router(diagram_versions.router, prefix="/api")
app.include_router(invitations.router, prefix="/api")
app.include_router(collaborators.router, prefix="/api")
app.include_router(oidc_providers.router, prefix="/api")
app.include_router(ldap_providers.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(scim_tokens.router, prefix="/api")
app.include_router(api_tokens.router, prefix="/api")
app.include_router(product_downloads.router, prefix="/api")
app.include_router(ai_config.router, prefix="/api")
app.include_router(ai_conversations.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(integrations.router, prefix="/api")
app.include_router(component_templates.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(attack.router, prefix="/api")
app.include_router(approvals.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
# WebSocket collaboration endpoint — no /api prefix, lives at /ws/diagrams/{id}
app.include_router(collaboration.router)
# SCIM endpoints are mounted at /scim/v2 (not /api) per RFC 7644 convention.
app.include_router(scim.router)
# Browser login/consent page for the /mcp OAuth flow — no prefix, paths are
# /oauth/login and /oauth/consent. Must be registered before the root MCP
# mount below so these routes match first.
app.include_router(mcp_oauth_ui.router)


@app.exception_handler(ScimError)
async def scim_error_handler(request: Request, exc: ScimError):
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.body(),
        media_type="application/scim+json",
    )


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "Welcome to ThreatAtlas API",
        "version": settings.api_version,
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# MCP server for AI coding tools (Claude Code, Claude.ai, etc.) — OAuth 2.1 +
# static ta_/JWT bearer tokens, both handled by ThreatAtlasOAuthProvider.
# FastMCP's streamable_http_app() returns a Starlette app whose routes
# include /mcp itself plus the OAuth routes (/authorize, /token, /register,
# /revoke, /.well-known/oauth-authorization-server,
# /.well-known/oauth-protected-resource/mcp) as siblings — RFC 8414/9728
# discovery expects those at the domain root, not under an "/mcp" prefix.
# Mounting at "/" as the LAST route means every route above (all /api/...,
# /, /health, /oauth/..., /scim/...) still matches first; only paths none of
# them own fall through to this sub-app.
from app.mcp.server import mcp_asgi_app  # noqa: E402
app.mount("/", mcp_asgi_app)
