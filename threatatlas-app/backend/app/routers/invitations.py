"""Invitation management endpoints for admin-only invitation-based user registration."""

import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models import User as UserModel, Invitation as InvitationModel
from app.schemas.invitation import (
    InvitationCreate,
    InvitationAccept,
    InvitationResponse,
    InvitationDetail,
)
from app.schemas.user import User
from app.auth.dependencies import get_current_user
from app.auth.password import get_password_hash
from app.auth.permissions import require_admin
from app.services.email_service import EmailService
from app.config import settings

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.post("/", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
def create_invitation(
    data: InvitationCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new invitation (admin only).

    Sends an email invitation to the specified email address.

    Args:
        data: Invitation data (email and role)
        current_user: Current authenticated user (must be admin)
        db: Database session

    Returns:
        Created invitation object

    Raises:
        HTTPException: If user not admin, user already exists, or active invitation exists
    """
    require_admin(current_user)

    # Check if user already exists
    if db.query(UserModel).filter(UserModel.email == data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )

    # Check for existing pending invitation
    existing_invitation = (
        db.query(InvitationModel)
        .filter(
            InvitationModel.email == data.email,
            InvitationModel.is_accepted == False,
            InvitationModel.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if existing_invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active invitation already exists for this email",
        )

    # Create invitation
    invitation = InvitationModel(
        email=data.email,
        token=InvitationModel.generate_token(),
        role=data.role,
        invited_by=current_user.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(hours=settings.invitation_expire_hours),
    )

    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    # Send invitation email
    try:
        EmailService.send_invitation_email(
            email=invitation.email,
            token=invitation.token,
            inviter_name=current_user.full_name or current_user.username,
            role=invitation.role,
        )
    except Exception as e:
        # Log error but don't fail the request
        # Admin can manually resend if needed
        print(f"Failed to send invitation email: {e}")

    return invitation


@router.get("/", response_model=list[InvitationResponse])
def list_invitations(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_expired: bool = False,
    include_accepted: bool = False,
):
    """
    List all invitations (admin only).

    Args:
        current_user: Current authenticated user (must be admin)
        db: Database session
        include_expired: Include expired invitations
        include_accepted: Include accepted invitations

    Returns:
        List of invitations
    """
    require_admin(current_user)

    query = db.query(InvitationModel)

    if not include_accepted:
        query = query.filter(InvitationModel.is_accepted == False)

    if not include_expired:
        query = query.filter(InvitationModel.expires_at > datetime.now(timezone.utc))

    return query.order_by(InvitationModel.created_at.desc()).all()


@router.get("/{token}", response_model=InvitationDetail)
def get_invitation(token: str, db: Session = Depends(get_db)):
    """
    Get invitation details by token (public endpoint for acceptance page).

    Args:
        token: Invitation token
        db: Database session

    Returns:
        Invitation details with inviter information

    Raises:
        HTTPException: If invitation not found
    """
    invitation = (
        db.query(InvitationModel)
        .filter(InvitationModel.token == token)
        .first()
    )

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    # Add inviter information
    response = InvitationDetail.model_validate(invitation)
    if invitation.invited_by_user:
        response.inviter_name = invitation.invited_by_user.full_name or invitation.invited_by_user.username
        response.inviter_email = invitation.invited_by_user.email

    return response


@router.post("/{token}/accept", response_model=User, status_code=status.HTTP_201_CREATED)
def accept_invitation(
    token: str,
    accept_data: InvitationAccept,
    db: Session = Depends(get_db),
):
    """
    Accept an invitation and create user account (public endpoint).

    Args:
        token: Invitation token
        accept_data: User account data (username, password, full_name)
        db: Database session

    Returns:
        Created user object

    Raises:
        HTTPException: If invitation invalid, expired, or username taken
    """
    invitation = (
        db.query(InvitationModel)
        .filter(InvitationModel.token == token)
        .first()
    )

    # Validate invitation
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    if invitation.is_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation already accepted",
        )

    if invitation.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation expired",
        )

    # Check username availability
    if (
        db.query(UserModel)
        .filter(UserModel.username == accept_data.username)
        .first()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Create user
    new_user = UserModel(
        email=invitation.email,
        username=accept_data.username,
        full_name=accept_data.full_name,
        hashed_password=get_password_hash(accept_data.password),
        role=invitation.role,
        invited_by=invitation.invited_by,
        is_active=True,
    )

    db.add(new_user)

    # Mark invitation as accepted
    invitation.is_accepted = True
    invitation.accepted_at = datetime.now(timezone.utc)
    invitation.user_id = new_user.id

    db.commit()
    db.refresh(new_user)

    # Send welcome email
    try:
        EmailService.send_welcome_email(
            email=new_user.email,
            username=new_user.username,
            full_name=new_user.full_name,
            role=new_user.role,
        )
    except Exception as e:
        # Log error but don't fail the registration
        logger.warning(f"Failed to send welcome email to {new_user.email}: {str(e)}")

    return new_user


@router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(
    invitation_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Revoke (delete) a pending invitation (admin only).

    Args:
        invitation_id: ID of invitation to revoke
        current_user: Current authenticated user (must be admin)
        db: Database session

    Raises:
        HTTPException: If user not admin or invitation not found
    """
    require_admin(current_user)

    invitation = (
        db.query(InvitationModel)
        .filter(InvitationModel.id == invitation_id)
        .first()
    )

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    db.delete(invitation)
    db.commit()


@router.post("/{invitation_id}/resend", response_model=InvitationResponse)
def resend_invitation(
    invitation_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Resend invitation email (admin only).

    Args:
        invitation_id: ID of invitation to resend
        current_user: Current authenticated user (must be admin)
        db: Database session

    Returns:
        Updated invitation object

    Raises:
        HTTPException: If user not admin, invitation not found, or already accepted
    """
    require_admin(current_user)

    invitation = (
        db.query(InvitationModel)
        .filter(InvitationModel.id == invitation_id)
        .first()
    )

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )

    if invitation.is_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot resend accepted invitation",
        )

    # Extend expiration if expired
    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.invitation_expire_hours
        )
        db.commit()
        db.refresh(invitation)

    # Resend email using reminder template
    try:
        EmailService.send_invitation_reminder_email(
            email=invitation.email,
            token=invitation.token,
            inviter_name=current_user.full_name or current_user.username,
            role=invitation.role,
            expiry_date=invitation.expires_at,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}",
        )

    return invitation
