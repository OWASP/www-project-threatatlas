from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
)
from app.routers import ai_config, ai_conversations


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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(ai_config.router, prefix="/api")
app.include_router(ai_conversations.router, prefix="/api")


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
