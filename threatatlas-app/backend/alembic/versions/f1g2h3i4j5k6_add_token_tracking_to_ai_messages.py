"""add token tracking to ai_messages

Revision ID: f1g2h3i4j5k6
Revises: a1f2b3c4d5e6
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa

revision = 'f1g2h3i4j5k6'
down_revision = 'a1f2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('ai_messages', sa.Column('input_tokens', sa.Integer(), nullable=True))
    op.add_column('ai_messages', sa.Column('output_tokens', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('ai_messages', 'output_tokens')
    op.drop_column('ai_messages', 'input_tokens')
