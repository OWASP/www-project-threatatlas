"""add acceptance review fields to diagram_threats

Revision ID: o0p1q2r3s4t5
Revises: n9o0p1q2r3s4
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'o0p1q2r3s4t5'
down_revision = 'n9o0p1q2r3s4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('diagram_threats', sa.Column('acceptance_review_status', sa.String(20), nullable=True))
    op.add_column('diagram_threats', sa.Column('acceptance_review_note', sa.Text(), nullable=True))
    op.add_column('diagram_threats', sa.Column('acceptance_reviewed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('diagram_threats', 'acceptance_reviewed_at')
    op.drop_column('diagram_threats', 'acceptance_review_note')
    op.drop_column('diagram_threats', 'acceptance_review_status')
