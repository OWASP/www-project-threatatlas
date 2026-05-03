"""add model tracking to ai_messages

Revision ID: g2h3i4j5k6l7
Revises: f1g2h3i4j5k6
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa

revision = 'g2h3i4j5k6l7'
down_revision = 'f1g2h3i4j5k6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('ai_messages', sa.Column('ai_model_name', sa.String(100), nullable=True))
    op.add_column('ai_messages', sa.Column('ai_provider', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('ai_messages', 'ai_provider')
    op.drop_column('ai_messages', 'ai_model_name')
