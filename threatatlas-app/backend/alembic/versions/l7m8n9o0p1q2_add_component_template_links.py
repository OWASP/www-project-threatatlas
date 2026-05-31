"""add component_template_threats and component_template_mitigations pivot tables

Revision ID: l7m8n9o0p1q2
Revises: k6l7m8n9o0p1
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'l7m8n9o0p1q2'
down_revision = 'k6l7m8n9o0p1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'component_template_threats',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('component_id', sa.Integer(), nullable=False),
        sa.Column('threat_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['component_id'], ['component_templates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['threat_id'], ['threats.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('component_id', 'threat_id'),
    )
    op.create_index('ix_ctt_component_id', 'component_template_threats', ['component_id'])

    op.create_table(
        'component_template_mitigations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('component_id', sa.Integer(), nullable=False),
        sa.Column('mitigation_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['component_id'], ['component_templates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['mitigation_id'], ['mitigations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('component_id', 'mitigation_id'),
    )
    op.create_index('ix_ctm_component_id', 'component_template_mitigations', ['component_id'])


def downgrade() -> None:
    op.drop_index('ix_ctm_component_id', table_name='component_template_mitigations')
    op.drop_table('component_template_mitigations')
    op.drop_index('ix_ctt_component_id', table_name='component_template_threats')
    op.drop_table('component_template_threats')
