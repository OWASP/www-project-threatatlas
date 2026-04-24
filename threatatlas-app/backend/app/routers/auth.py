from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client.errors import OAuthError

from app.database import get_db
from app.models import OIDCProviderConfig, User as UserModel
from app.schemas.auth import Token, LoginRequest, OIDCProviderInfo
from app.schemas.user import UserCreate, User
from app.auth.password import verify_password
from app.auth.jwt import create_access_token
from app.auth.dependencies import get_current_user
from app.auth.secrets import decrypt_secret
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_oauth_for(provider: OIDCProviderConfig) -> OAuth:
    """Create a fresh Authlib OAuth container with a single client registered."""
    metadata_url = provider.metadata_url or (
        f"{provider.issuer.rstrip('/')}/.well-known/openid-configuration"
    )
    oauth = OAuth()
    oauth.register(
        name=provider.name,
        client_id=provider.client_id,
        client_secret=decrypt_secret(provider.client_secret_encrypted),
        server_metadata_url=metadata_url,
        client_kwargs={"scope": provider.scopes},
    )
    return oauth


def _get_enabled_provider(db: Session, name: str) -> OIDCProviderConfig:
    provider = (
        db.query(OIDCProviderConfig)
        .filter(OIDCProviderConfig.name == name, OIDCProviderConfig.is_enabled.is_(True))
        .first()
    )
    if provider is None:
        raise HTTPException(status_code=404, detail=f"OIDC provider '{name}' is not configured or disabled")
    return provider


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """Public registration is disabled — users must be invited."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Direct registration is disabled. Please use an invitation link from an administrator.",
    )


@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Local login with email + password."""
    user = db.query(UserModel).filter(UserModel.email == login_data.email).first()

    if not user or not user.hashed_password or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=User)
def read_users_me(current_user: UserModel = Depends(get_current_user)):
    return current_user


# ---------------------------------------------------------------------------
# Generic OIDC SSO — provider list is DB-backed (managed via /api/sso/providers).
# ---------------------------------------------------------------------------


@router.get("/oidc/providers", response_model=list[OIDCProviderInfo])
def list_oidc_providers(db: Session = Depends(get_db)):
    """Public list of enabled OIDC providers — consumed by the login UI."""
    providers = (
        db.query(OIDCProviderConfig)
        .filter(OIDCProviderConfig.is_enabled.is_(True))
        .order_by(OIDCProviderConfig.display_name)
        .all()
    )
    return [
        OIDCProviderInfo(
            name=p.name,
            display_name=p.display_name,
            login_url=f"/api/auth/oidc/{p.name}/login",
        )
        for p in providers
    ]


@router.get("/oidc/{provider_name}/login")
async def oidc_login(provider_name: str, request: Request, db: Session = Depends(get_db)):
    provider = _get_enabled_provider(db, provider_name)
    client = _build_oauth_for(provider).create_client(provider.name)
    redirect_uri = str(request.url_for("oidc_callback", provider_name=provider.name))
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/oidc/{provider_name}/callback", name="oidc_callback")
async def oidc_callback(provider_name: str, request: Request, db: Session = Depends(get_db)):
    """Validate the IdP callback, upsert the user, issue a JWT, and redirect to the SPA."""
    provider = _get_enabled_provider(db, provider_name)
    client = _build_oauth_for(provider).create_client(provider.name)

    try:
        token = await client.authorize_access_token(request)
    except OAuthError as exc:
        return RedirectResponse(url=f"{settings.frontend_url}/login?error={exc.error}")

    claims = token.get("userinfo")
    if claims is None:
        claims = await client.userinfo(token=token)

    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="IdP did not return an email claim")

    full_name = (
        claims.get("name")
        or " ".join(filter(None, [claims.get("given_name"), claims.get("family_name")]))
        or email
    )

    db_user = db.query(UserModel).filter(UserModel.email == email).first()
    if not db_user:
        db_user = UserModel(
            email=email,
            username=email,
            full_name=full_name,
            hashed_password=None,
            is_active=True,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

    if not db_user.is_active:
        return RedirectResponse(url=f"{settings.frontend_url}/login?error=inactive_account")

    access_token = create_access_token(
        data={"sub": str(db_user.id)},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return RedirectResponse(url=f"{settings.frontend_url}/auth/callback?token={access_token}")
