"""rename notes to comments

Revision ID: b6c1f1f1f1f1
Revises: b905d9a6c542
Create Date: 2026-03-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6c1f1f1f1f1'
down_revision: Union[str, Sequence[str], None] = 'b905d9a6c542'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename notes to comments
    op.alter_column('diagram_threats', 'notes', new_column_name='comments', existing_type=sa.Text())
    op.alter_column('diagram_mitigations', 'notes', new_column_name='comments', existing_type=sa.Text())
    op.alter_column('diagram_threat_versions', 'notes', new_column_name='comments', existing_type=sa.Text())
    op.alter_column('diagram_mitigation_versions', 'notes', new_column_name='comments', existing_type=sa.Text())


def downgrade() -> None:
    # Revert comments to notes
    op.alter_column('diagram_threats', 'comments', new_column_name='notes', existing_type=sa.Text())
    op.alter_column('diagram_mitigations', 'comments', new_column_name='notes', existing_type=sa.Text())
    op.alter_column('diagram_threat_versions', 'comments', new_column_name='notes', existing_type=sa.Text())
    op.alter_column('diagram_mitigation_versions', 'comments', new_column_name='notes', existing_type=sa.Text())
