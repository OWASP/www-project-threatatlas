"""add_oidc_providers

Revision ID: c9f1a2b3e4d5
Revises: b6c1f1f1f1f1
Create Date: 2026-04-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9f1a2b3e4d5"
down_revision: Union[str, Sequence[str], None] = "b6c1f1f1f1f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "oidc_providers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=128), nullable=False),
        sa.Column("issuer", sa.String(length=512), nullable=False),
        sa.Column("client_id", sa.String(length=256), nullable=False),
        sa.Column("client_secret_encrypted", sa.String(length=1024), nullable=False),
        sa.Column("scopes", sa.String(length=256), nullable=False, server_default="openid email profile"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_oidc_providers_id"), "oidc_providers", ["id"], unique=False)
    op.create_index(op.f("ix_oidc_providers_name"), "oidc_providers", ["name"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_oidc_providers_name"), table_name="oidc_providers")
    op.drop_index(op.f("ix_oidc_providers_id"), table_name="oidc_providers")
    op.drop_table("oidc_providers")
