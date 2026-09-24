"""add manual residual risk assessments

Revision ID: w1x2y3z4a5b6
Revises: v7w8x9y0z1a2
Create Date: 2026-09-24 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "w1x2y3z4a5b6"
down_revision = "v7w8x9y0z1a2"
branch_labels = None
depends_on = None


_RESIDUAL_COLUMNS = (
    ("residual_likelihood", sa.Integer()),
    ("residual_impact", sa.Integer()),
    ("residual_risk_score", sa.Integer()),
    ("residual_severity", sa.String(length=20)),
    ("residual_comments", sa.Text()),
)


def upgrade() -> None:
    for table in ("diagram_threats", "diagram_threat_versions"):
        for name, column_type in _RESIDUAL_COLUMNS:
            op.add_column(table, sa.Column(name, column_type, nullable=True))


def downgrade() -> None:
    for table in ("diagram_threat_versions", "diagram_threats"):
        for name, _column_type in reversed(_RESIDUAL_COLUMNS):
            op.drop_column(table, name)
