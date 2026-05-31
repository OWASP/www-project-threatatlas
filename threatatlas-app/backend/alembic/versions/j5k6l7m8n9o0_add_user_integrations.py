"""add user_integrations table for per-user JIRA config

Revision ID: j5k6l7m8n9o0
Revises: i4j5k6l7m8n9
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa

revision = 'j5k6l7m8n9o0'
down_revision = 'i4j5k6l7m8n9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_integrations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('jira_url', sa.String(500), nullable=True),
        sa.Column('jira_email', sa.String(255), nullable=True),
        sa.Column('jira_token_encrypted', sa.Text(), nullable=True),
        sa.Column('jira_project_key', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'type', name='uq_user_integrations_user_type'),
    )
    op.create_index('ix_user_integrations_id', 'user_integrations', ['id'])
    op.create_index('ix_user_integrations_user_id', 'user_integrations', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_user_integrations_user_id', table_name='user_integrations')
    op.drop_index('ix_user_integrations_id', table_name='user_integrations')
    op.drop_table('user_integrations')
