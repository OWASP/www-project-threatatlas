"""add_groups_and_scim

Adds:
  - `groups` table + `user_groups` junction for role-granting group membership
  - `scim_external_id` on `users` and `groups` for IdP reconciliation
  - `scim_tokens` table for bearer-token auth on /scim/v2

Revision ID: f1a2b3c4d5e6
Revises: e1a2b3c4d5e6
Create Date: 2026-04-24 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


USERROLE = postgresql.ENUM("admin", "standard", "read_only", name="userrole", create_type=False)


def upgrade() -> None:
    # scim_external_id on users
    op.add_column("users", sa.Column("scim_external_id", sa.String(length=256), nullable=True))
    op.create_index("ix_users_scim_external_id", "users", ["scim_external_id"], unique=True)

    # groups table
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("role", USERROLE, nullable=False),
        sa.Column("scim_external_id", sa.String(length=256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_groups_id", "groups", ["id"], unique=False)
    op.create_index("ix_groups_name", "groups", ["name"], unique=True)
    op.create_index("ix_groups_scim_external_id", "groups", ["scim_external_id"], unique=True)

    # user_groups junction
    op.create_table(
        "user_groups",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "group_id"),
    )

    # scim_tokens
    op.create_table(
        "scim_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scim_tokens_id", "scim_tokens", ["id"], unique=False)
    op.create_index("ix_scim_tokens_token_hash", "scim_tokens", ["token_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_scim_tokens_token_hash", table_name="scim_tokens")
    op.drop_index("ix_scim_tokens_id", table_name="scim_tokens")
    op.drop_table("scim_tokens")

    op.drop_table("user_groups")

    op.drop_index("ix_groups_scim_external_id", table_name="groups")
    op.drop_index("ix_groups_name", table_name="groups")
    op.drop_index("ix_groups_id", table_name="groups")
    op.drop_table("groups")

    op.drop_index("ix_users_scim_external_id", table_name="users")
    op.drop_column("users", "scim_external_id")
