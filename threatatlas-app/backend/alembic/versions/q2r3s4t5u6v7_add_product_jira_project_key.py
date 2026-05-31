"""add product jira_project_key

Revision ID: q2r3s4t5u6v7
Revises: p1q2r3s4t5u6
Create Date: 2026-05-27 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'q2r3s4t5u6v7'
down_revision = 'p1q2r3s4t5u6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('jira_project_key', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'jira_project_key')
