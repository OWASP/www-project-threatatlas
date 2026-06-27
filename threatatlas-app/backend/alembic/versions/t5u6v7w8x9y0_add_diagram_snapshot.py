"""add snapshot column to diagrams

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-06-05

"""
from alembic import op
import sqlalchemy as sa

revision = 't5u6v7w8x9y0'
down_revision = 's4t5u6v7w8x9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('diagrams', sa.Column('snapshot', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('diagrams', 'snapshot')
