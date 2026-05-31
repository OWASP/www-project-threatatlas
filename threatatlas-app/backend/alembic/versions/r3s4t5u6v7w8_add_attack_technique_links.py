"""add diagram_threat_attack_techniques

Revision ID: r3s4t5u6v7w8
Revises: q2r3s4t5u6v7
Create Date: 2026-05-29 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'r3s4t5u6v7w8'
down_revision = 'q2r3s4t5u6v7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'diagram_threat_attack_techniques',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('diagram_threat_id', sa.Integer(), nullable=False),
        sa.Column('technique_id', sa.String(length=20), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['diagram_threat_id'], ['diagram_threats.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('diagram_threat_id', 'technique_id', name='uq_threat_technique'),
    )
    op.create_index(
        'ix_diagram_threat_attack_techniques_diagram_threat_id',
        'diagram_threat_attack_techniques',
        ['diagram_threat_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_diagram_threat_attack_techniques_diagram_threat_id', table_name='diagram_threat_attack_techniques')
    op.drop_table('diagram_threat_attack_techniques')
