"""add component_templates table for Component Threat Library

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa

revision = 'k6l7m8n9o0p1'
down_revision = 'j5k6l7m8n9o0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'component_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('node_type', sa.String(50), nullable=False),
        sa.Column('icon', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('threats', sa.JSON(), nullable=False),
        sa.Column('mitigations', sa.JSON(), nullable=False),
        sa.Column('is_custom', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_component_templates_slug'),
    )
    op.create_index('ix_component_templates_id', 'component_templates', ['id'])
    op.create_index('ix_component_templates_slug', 'component_templates', ['slug'])


def downgrade() -> None:
    op.drop_index('ix_component_templates_slug', table_name='component_templates')
    op.drop_index('ix_component_templates_id', table_name='component_templates')
    op.drop_table('component_templates')
