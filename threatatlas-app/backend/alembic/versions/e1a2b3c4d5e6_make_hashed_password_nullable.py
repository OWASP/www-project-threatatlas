"""make_hashed_password_nullable

SSO (OIDC) users have no local password — relax the NOT NULL constraint on
users.hashed_password so they can be persisted after IdP authentication.

Revision ID: e1a2b3c4d5e6
Revises: d0e1f2a3b4c5
Create Date: 2026-04-24 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "hashed_password", existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    op.execute("UPDATE users SET hashed_password = '' WHERE hashed_password IS NULL")
    op.alter_column("users", "hashed_password", existing_type=sa.String(length=255), nullable=False)
