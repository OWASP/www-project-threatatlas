"""Admin CRUD for SCIM bearer tokens."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ScimToken, User as UserModel
from app.schemas.scim_token import ScimTokenCreate, ScimTokenCreated, ScimTokenRead
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_admin
from app.auth.scim_auth import generate_token, hash_token

router = APIRouter(prefix="/scim-tokens", tags=["scim"])


@router.get("/", response_model=list[ScimTokenRead])
def list_tokens(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    return db.query(ScimToken).order_by(ScimToken.created_at.desc()).all()


@router.post("/", response_model=ScimTokenCreated, status_code=status.HTTP_201_CREATED)
def create_token(
    payload: ScimTokenCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    raw = generate_token()
    row = ScimToken(name=payload.name, token_hash=hash_token(raw), created_by=current_user.id)
    db.add(row)
    db.commit()
    db.refresh(row)

    return ScimTokenCreated(
        id=row.id,
        name=row.name,
        last_used_at=row.last_used_at,
        created_at=row.created_at,
        token=raw,
    )


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_token(
    token_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    row = db.query(ScimToken).filter(ScimToken.id == token_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Token not found")
    db.delete(row)
    db.commit()
