"""add is_modified and original snapshot columns to component_templates

Revision ID: m8n9o0p1q2r3
Revises: l7m8n9o0p1q2
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'm8n9o0p1q2r3'
down_revision = 'l7m8n9o0p1q2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('component_templates', sa.Column('is_modified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('component_templates', sa.Column('original_name', sa.String(200), nullable=True))
    op.add_column('component_templates', sa.Column('original_description', sa.Text(), nullable=True))
    op.add_column('component_templates', sa.Column('original_category', sa.String(100), nullable=True))
    op.add_column('component_templates', sa.Column('original_node_type', sa.String(50), nullable=True))
    op.add_column('component_templates', sa.Column('original_icon', sa.String(100), nullable=True))
    op.add_column('component_templates', sa.Column('original_threat_ids', sa.JSON(), nullable=True))
    op.add_column('component_templates', sa.Column('original_mitigation_ids', sa.JSON(), nullable=True))


def downgrade() -> None:
    for col in ['is_modified', 'original_name', 'original_description', 'original_category',
                'original_node_type', 'original_icon', 'original_threat_ids', 'original_mitigation_ids']:
        op.drop_column('component_templates', col)
