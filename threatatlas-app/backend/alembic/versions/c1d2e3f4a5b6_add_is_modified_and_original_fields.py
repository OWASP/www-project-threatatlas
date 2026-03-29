"""add_is_modified_and_original_fields_to_threats_and_mitigations

Revision ID: c1d2e3f4a5b6
Revises: b6c1f1f1f1f1
Create Date: 2026-03-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'b6c1f1f1f1f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_modified and original_* snapshot fields to threats and mitigations."""
    op.add_column('threats', sa.Column('is_modified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('threats', sa.Column('original_name', sa.String(200), nullable=True))
    op.add_column('threats', sa.Column('original_description', sa.Text(), nullable=True))
    op.add_column('threats', sa.Column('original_category', sa.String(100), nullable=True))

    op.add_column('mitigations', sa.Column('is_modified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('mitigations', sa.Column('original_name', sa.String(200), nullable=True))
    op.add_column('mitigations', sa.Column('original_description', sa.Text(), nullable=True))
    op.add_column('mitigations', sa.Column('original_category', sa.String(100), nullable=True))


def downgrade() -> None:
    """Remove is_modified and original_* fields."""
    op.drop_column('mitigations', 'original_category')
    op.drop_column('mitigations', 'original_description')
    op.drop_column('mitigations', 'original_name')
    op.drop_column('mitigations', 'is_modified')

    op.drop_column('threats', 'original_category')
    op.drop_column('threats', 'original_description')
    op.drop_column('threats', 'original_name')
    op.drop_column('threats', 'is_modified')
