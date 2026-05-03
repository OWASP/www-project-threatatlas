"""Add AI config, conversations, and messages tables

Revision ID: a1f2b3c4d5e6
Revises: 1e4c215959d3
Create Date: 2026-04-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1f2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('api_key_encrypted', sa.LargeBinary(), nullable=False),
        sa.Column('base_url', sa.String(500), nullable=True),
        sa.Column('temperature', sa.Float(), nullable=True, default=0.7),
        sa.Column('max_tokens', sa.Integer(), nullable=True, default=4096),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ai_configs_id', 'ai_configs', ['id'], unique=False)

    op.create_table(
        'ai_conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('diagram_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['diagram_id'], ['diagrams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ai_conversations_id', 'ai_conversations', ['id'], unique=False)
    op.create_index('ix_ai_conversations_diagram_id', 'ai_conversations', ['diagram_id'], unique=False)
    op.create_index('ix_ai_conversations_user_id', 'ai_conversations', ['user_id'], unique=False)

    op.create_table(
        'ai_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('proposals', sa.JSON(), nullable=True),
        sa.Column('token_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['conversation_id'], ['ai_conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ai_messages_id', 'ai_messages', ['id'], unique=False)
    op.create_index('ix_ai_messages_conversation_id', 'ai_messages', ['conversation_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_ai_messages_conversation_id', table_name='ai_messages')
    op.drop_index('ix_ai_messages_id', table_name='ai_messages')
    op.drop_table('ai_messages')

    op.drop_index('ix_ai_conversations_user_id', table_name='ai_conversations')
    op.drop_index('ix_ai_conversations_diagram_id', table_name='ai_conversations')
    op.drop_index('ix_ai_conversations_id', table_name='ai_conversations')
    op.drop_table('ai_conversations')

    op.drop_index('ix_ai_configs_id', table_name='ai_configs')
    op.drop_table('ai_configs')
