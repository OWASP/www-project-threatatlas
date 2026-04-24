"""Admin CRUD for groups and membership."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Group, User as UserModel
from app.schemas.group import (
    GroupCreate,
    GroupDetail,
    GroupMemberUpdate,
    GroupRead,
    GroupUpdate,
)
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_admin

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("/", response_model=list[GroupRead])
def list_groups(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    return db.query(Group).order_by(Group.name).all()


@router.post("/", response_model=GroupDetail, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    group = Group(name=payload.name, description=payload.description, role=payload.role)
    db.add(group)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Group '{payload.name}' already exists")
    db.refresh(group)
    return group


@router.get("/{group_id}", response_model=GroupDetail)
def get_group(
    group_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.put("/{group_id}", response_model=GroupDetail)
def update_group(
    group_id: int,
    payload: GroupUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(group, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Group name already in use")
    db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.delete(group)
    db.commit()


@router.put("/{group_id}/members", response_model=GroupDetail)
def set_members(
    group_id: int,
    payload: GroupMemberUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replace group membership with the given user-ID list."""
    require_admin(current_user)
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    users = db.query(UserModel).filter(UserModel.id.in_(payload.user_ids)).all() if payload.user_ids else []
    missing = set(payload.user_ids) - {u.id for u in users}
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown user IDs: {sorted(missing)}")

    group.members = users
    db.commit()
    db.refresh(group)
    return group


@router.post("/{group_id}/members/{user_id}", response_model=GroupDetail)
def add_member(
    group_id: int,
    user_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user not in group.members:
        group.members.append(user)
        db.commit()
        db.refresh(group)
    return group


@router.delete("/{group_id}/members/{user_id}", response_model=GroupDetail)
def remove_member(
    group_id: int,
    user_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.members = [u for u in group.members if u.id != user_id]
    db.commit()
    db.refresh(group)
    return group
