"""Admin CRUD for OIDC identity-provider configurations."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import OIDCProviderConfig, User as UserModel
from app.schemas.oidc_provider import (
    OIDCProviderCreate,
    OIDCProviderRead,
    OIDCProviderUpdate,
)
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_admin
from app.auth.secrets import encrypt_secret

router = APIRouter(prefix="/sso/providers", tags=["sso"])


@router.get("/", response_model=list[OIDCProviderRead])
def list_providers(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    return db.query(OIDCProviderConfig).order_by(OIDCProviderConfig.id).all()


@router.post("/", response_model=OIDCProviderRead, status_code=status.HTTP_201_CREATED)
def create_provider(
    payload: OIDCProviderCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    provider = OIDCProviderConfig(
        name=payload.name,
        display_name=payload.display_name,
        issuer=payload.issuer,
        metadata_url=payload.metadata_url,
        client_id=payload.client_id,
        client_secret_encrypted=encrypt_secret(payload.client_secret),
        scopes=payload.scopes,
        is_enabled=payload.is_enabled,
    )
    db.add(provider)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"OIDC provider with name '{payload.name}' already exists",
        )
    db.refresh(provider)
    return provider


@router.put("/{provider_id}", response_model=OIDCProviderRead)
def update_provider(
    provider_id: int,
    payload: OIDCProviderUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    provider = db.query(OIDCProviderConfig).filter(OIDCProviderConfig.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="OIDC provider not found")

    data = payload.model_dump(exclude_unset=True)
    new_secret = data.pop("client_secret", None)
    if new_secret:
        provider.client_secret_encrypted = encrypt_secret(new_secret)
    for field, value in data.items():
        setattr(provider, field, value)

    db.commit()
    db.refresh(provider)
    return provider


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_provider(
    provider_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    provider = db.query(OIDCProviderConfig).filter(OIDCProviderConfig.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="OIDC provider not found")

    db.delete(provider)
    db.commit()
