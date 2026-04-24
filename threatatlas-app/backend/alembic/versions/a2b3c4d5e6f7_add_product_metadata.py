"""add_product_metadata

Adds optional project-metadata columns to `products`:
  - status (enum productstatus)
  - repository_url, confluence_url, application_url
  - business_area, owner_name, owner_email

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-04-24 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE productstatus AS ENUM ('design', 'development', 'testing', 'deployment', 'production')"
    )
    product_status = postgresql.ENUM(
        "design", "development", "testing", "deployment", "production",
        name="productstatus", create_type=False,
    )

    op.add_column("products", sa.Column("status", product_status, nullable=True))
    op.add_column("products", sa.Column("repository_url", sa.String(length=500), nullable=True))
    op.add_column("products", sa.Column("confluence_url", sa.String(length=500), nullable=True))
    op.add_column("products", sa.Column("application_url", sa.String(length=500), nullable=True))
    op.add_column("products", sa.Column("business_area", sa.String(length=200), nullable=True))
    op.add_column("products", sa.Column("owner_name", sa.String(length=200), nullable=True))
    op.add_column("products", sa.Column("owner_email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "owner_email")
    op.drop_column("products", "owner_name")
    op.drop_column("products", "business_area")
    op.drop_column("products", "application_url")
    op.drop_column("products", "confluence_url")
    op.drop_column("products", "repository_url")
    op.drop_column("products", "status")
    op.execute("DROP TYPE productstatus")
