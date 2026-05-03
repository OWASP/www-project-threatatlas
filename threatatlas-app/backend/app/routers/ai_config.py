from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AIConfig as AIConfigModel, User as UserModel
from app.models.ai import AIConversation, AIMessage
from app.schemas.ai import AIConfigCreate, AIConfigResponse, AIConfigUpdate
from app.ai.encryption import decrypt_api_key, encrypt_api_key, mask_api_key
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_admin

router = APIRouter(prefix="/ai-config", tags=["ai-config"])


def _to_response(cfg: AIConfigModel) -> AIConfigResponse:
    plaintext = decrypt_api_key(cfg.api_key_encrypted)
    return AIConfigResponse(
        id=cfg.id,
        provider=cfg.provider,
        model_name=cfg.model_name,
        api_key_masked=mask_api_key(plaintext),
        base_url=cfg.base_url,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        is_active=cfg.is_active,
        created_at=cfg.created_at,
    )


@router.get("/", response_model=AIConfigResponse | None)
def get_config(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the active AI configuration (admin only; returns None if not configured)."""
    require_admin(current_user)
    cfg = db.query(AIConfigModel).filter(AIConfigModel.is_active == True).first()
    if not cfg:
        return None
    return _to_response(cfg)


@router.post("/", response_model=AIConfigResponse, status_code=status.HTTP_201_CREATED)
def create_config(
    body: AIConfigCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or replace the AI configuration (admin only)."""
    require_admin(current_user)

    # Deactivate any existing configs
    db.query(AIConfigModel).filter(AIConfigModel.is_active == True).update({"is_active": False})

    cfg = AIConfigModel(
        provider=body.provider,
        model_name=body.model_name,
        api_key_encrypted=encrypt_api_key(body.api_key),
        base_url=body.base_url,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return _to_response(cfg)


@router.put("/{config_id}", response_model=AIConfigResponse)
def update_config(
    config_id: int,
    body: AIConfigUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update AI configuration (admin only)."""
    require_admin(current_user)
    cfg = db.query(AIConfigModel).filter(AIConfigModel.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI config not found")

    update_data = body.model_dump(exclude_unset=True)
    if "api_key" in update_data:
        cfg.api_key_encrypted = encrypt_api_key(update_data.pop("api_key"))
    for field, value in update_data.items():
        setattr(cfg, field, value)

    db.commit()
    db.refresh(cfg)
    return _to_response(cfg)


@router.post("/test")
async def test_config(
    body: AIConfigCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Test an AI configuration by making a minimal API call (admin only). Does NOT save to DB."""
    require_admin(current_user)

    # Resolve the API key — if the sentinel is sent, fall back to the stored active config key
    from app.ai.encryption import encrypt_api_key as _enc, decrypt_api_key as _dec
    _SENTINEL = "____keep____"
    if body.api_key == _SENTINEL:
        stored = db.query(AIConfigModel).filter(AIConfigModel.is_active == True).first()
        if not stored:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No saved API key found. Please enter the API key to test.",
            )
        resolved_key_encrypted = stored.api_key_encrypted
    else:
        resolved_key_encrypted = _enc(body.api_key)

    # Build a temporary in-memory AIConfig object (not persisted)
    from app.models.ai import AIConfig as AIConfigModel2
    temp_cfg = AIConfigModel2(
        provider=body.provider,
        model_name=body.model_name,
        api_key_encrypted=resolved_key_encrypted,
        base_url=body.base_url,
        temperature=body.temperature,
        max_tokens=min(body.max_tokens, 256),
    )

    try:
        from app.ai.agent import build_agent, AgentDeps
        from dataclasses import field as dc_field
        import dataclasses

        agent = build_agent(temp_cfg)

        # Minimal test: ask the agent a single conversational question with no DB deps
        # We use a stub deps object that has no DB so no tools will be called
        @dataclasses.dataclass
        class _StubDeps:
            db: None = None
            diagram_id: int = 0
            conversation_id: int = 0
            model_id: None = None
            framework_id: None = None
            proposals: list = dataclasses.field(default_factory=list)

        from pydantic_ai.usage import UsageLimits
        result = await agent.run(
            "Reply with exactly: OK",
            deps=_StubDeps(),
            usage_limits=UsageLimits(request_limit=3),
        )
        return {"ok": True, "response": str(result.output)[:200]}

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Connection failed: {str(exc)}"
        )


@router.get("/token-stats")
def get_token_stats(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return aggregate + per-model token consumption stats (admin only)."""
    require_admin(current_user)

    # Totals
    row = db.query(
        func.coalesce(func.sum(AIMessage.input_tokens), 0).label("input_tokens"),
        func.coalesce(func.sum(AIMessage.output_tokens), 0).label("output_tokens"),
        func.coalesce(func.sum(AIMessage.token_count), 0).label("total_tokens"),
        func.count(AIMessage.id).label("message_count"),
    ).filter(AIMessage.role == "assistant").one()

    conversation_count = db.query(func.count(AIConversation.id)).scalar() or 0

    # Per-model breakdown (grouped by provider + model_name)
    per_model_rows = db.query(
        AIMessage.ai_provider,
        AIMessage.ai_model_name,
        func.coalesce(func.sum(AIMessage.input_tokens), 0).label("input_tokens"),
        func.coalesce(func.sum(AIMessage.output_tokens), 0).label("output_tokens"),
        func.coalesce(func.sum(AIMessage.token_count), 0).label("total_tokens"),
        func.count(AIMessage.id).label("message_count"),
    ).filter(
        AIMessage.role == "assistant",
        AIMessage.ai_model_name.isnot(None),
    ).group_by(
        AIMessage.ai_provider,
        AIMessage.ai_model_name,
    ).order_by(
        func.sum(AIMessage.token_count).desc(),
    ).all()

    # Active config for fallback display
    cfg = db.query(AIConfigModel).filter(AIConfigModel.is_active == True).first()

    return {
        "input_tokens": int(row.input_tokens),
        "output_tokens": int(row.output_tokens),
        "total_tokens": int(row.total_tokens),
        "message_count": int(row.message_count),
        "conversation_count": int(conversation_count),
        "provider": cfg.provider if cfg else None,
        "model_name": cfg.model_name if cfg else None,
        "per_model": [
            {
                "provider": r.ai_provider,
                "model_name": r.ai_model_name,
                "input_tokens": int(r.input_tokens),
                "output_tokens": int(r.output_tokens),
                "total_tokens": int(r.total_tokens),
                "message_count": int(r.message_count),
            }
            for r in per_model_rows
        ],
    }


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_config(
    config_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete AI configuration (admin only)."""
    require_admin(current_user)
    cfg = db.query(AIConfigModel).filter(AIConfigModel.id == config_id).first()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI config not found")
    db.delete(cfg)
    db.commit()
