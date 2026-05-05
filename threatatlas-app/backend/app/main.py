from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
import logging

from app.config import settings

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
    groups,
    scim_tokens,
    scim,
    product_downloads,
)
from app.routers import ai_config, ai_conversations
from app.routers.scim import ScimError


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: seed knowledge base.  Shutdown: nothing to clean up."""
    from app.seed import seed_knowledge_base
    seed_knowledge_base()
    yield


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    debug=settings.debug,
    lifespan=lifespan,
)

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
app.include_router(groups.router, prefix="/api")
app.include_router(scim_tokens.router, prefix="/api")
app.include_router(product_downloads.router, prefix="/api")
app.include_router(ai_config.router, prefix="/api")
app.include_router(ai_conversations.router, prefix="/api")
# SCIM endpoints are mounted at /scim/v2 (not /api) per RFC 7644 convention.
app.include_router(scim.router)


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
