"""add acceptance fields to diagram_threats

Revision ID: n9o0p1q2r3s4
Revises: m8n9o0p1q2r3
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'n9o0p1q2r3s4'
down_revision = 'm8n9o0p1q2r3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('diagram_threats', sa.Column('acceptance_justification', sa.Text(), nullable=True))
    op.add_column('diagram_threats', sa.Column('acceptance_approver_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.add_column('diagram_threats', sa.Column('acceptance_review_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('diagram_threats', sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('diagram_threats', 'accepted_at')
    op.drop_column('diagram_threats', 'acceptance_review_date')
    op.drop_column('diagram_threats', 'acceptance_approver_id')
    op.drop_column('diagram_threats', 'acceptance_justification')
