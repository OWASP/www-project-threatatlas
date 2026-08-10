"""add native LDAP authentication

Revision ID: v7w8x9y0z1a2
Revises: u6v7w8x9y0z1
Create Date: 2026-07-19 20:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "v7w8x9y0z1a2"
down_revision = "v1w2x3y4z5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ldap_providers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=128), nullable=False),
        sa.Column("host", sa.String(length=255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("encryption", sa.String(length=16), nullable=False),
        sa.Column("verify_cert", sa.Boolean(), nullable=False),
        sa.Column("bind_dn", sa.String(length=1024), nullable=False),
        sa.Column("bind_password_encrypted", sa.String(length=2048), nullable=False),
        sa.Column("user_base_dn", sa.String(length=1024), nullable=False),
        sa.Column("user_filter", sa.String(length=1024), nullable=False),
        sa.Column("username_attribute", sa.String(length=128), nullable=False),
        sa.Column("email_attribute", sa.String(length=128), nullable=False),
        sa.Column("display_name_attribute", sa.String(length=128), nullable=False),
        sa.Column("active_directory", sa.Boolean(), nullable=False),
        sa.Column("auto_create_users", sa.Boolean(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ldap_providers_id"), "ldap_providers", ["id"], unique=False)
    op.create_index(op.f("ix_ldap_providers_name"), "ldap_providers", ["name"], unique=True)

    op.add_column("users", sa.Column("ldap_provider", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("ldap_dn", sa.String(length=1024), nullable=True))
    op.create_unique_constraint("uq_users_ldap_identity", "users", ["ldap_provider", "ldap_dn"])


def downgrade() -> None:
    op.drop_constraint("uq_users_ldap_identity", "users", type_="unique")
    op.drop_column("users", "ldap_dn")
    op.drop_column("users", "ldap_provider")
    op.drop_index(op.f("ix_ldap_providers_name"), table_name="ldap_providers")
    op.drop_index(op.f("ix_ldap_providers_id"), table_name="ldap_providers")
    op.drop_table("ldap_providers")
