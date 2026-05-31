"""add audit_events table for append-only audit logging

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa

revision = 'i4j5k6l7m8n9'
down_revision = 'h3i4j5k6l7m8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'audit_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('diagram_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(80), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_name', sa.String(500), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['diagram_id'], ['diagrams.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_events_id', 'audit_events', ['id'])
    op.create_index('ix_audit_events_product_id', 'audit_events', ['product_id'])
    op.create_index('ix_audit_events_created_at', 'audit_events', ['created_at'])
    # Composite index for efficient per-product timeline queries (newest-first)
    op.execute(
        "CREATE INDEX ix_audit_events_product_id_created_at "
        "ON audit_events (product_id, created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_audit_events_product_id_created_at")
    op.drop_index('ix_audit_events_created_at', table_name='audit_events')
    op.drop_index('ix_audit_events_product_id', table_name='audit_events')
    op.drop_index('ix_audit_events_id', table_name='audit_events')
    op.drop_table('audit_events')
