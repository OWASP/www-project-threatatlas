"""add_oidc_metadata_url

Revision ID: d0e1f2a3b4c5
Revises: c9f1a2b3e4d5
Create Date: 2026-04-24 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, Sequence[str], None] = "c9f1a2b3e4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "oidc_providers",
        sa.Column("metadata_url", sa.String(length=1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("oidc_providers", "metadata_url")
