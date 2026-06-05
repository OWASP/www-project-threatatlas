"""add reviewer and contributors to products

Revision ID: s4t5u6v7w8x9
Revises: r3s4t5u6v7w8
Create Date: 2026-06-04 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 's4t5u6v7w8x9'
down_revision = 'r3s4t5u6v7w8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('reviewer', sa.String(500), nullable=True))
    op.add_column('products', sa.Column('contributors', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'contributors')
    op.drop_column('products', 'reviewer')
