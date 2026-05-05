"""merge_heads — unify product-metadata branch with the upstream AI branch

Both branches forked from b6c1f1f1f1f1 and added independent migrations:

  this PR : b6c1f1f1f1f1 -> c9f1a2b3e4d5 (oidc) -> d0e1f2a3b4c5 (oidc metadata)
            -> e1a2b3c4d5e6 (hashed_password nullable) -> f1a2b3c4d5e6 (groups/scim)
            -> a2b3c4d5e6f7 (product metadata)

  upstream: b6c1f1f1f1f1 -> c1d2e3f4a5b6 (is_modified) -> e5f6a7b8c9d0 (is_public)
            -> a1f2b3c4d5e6 (ai_tables) -> f1g2h3i4j5k6 (token tracking)
            -> g2h3i4j5k6l7 (model tracking)

This empty migration declares both as its parents, giving alembic a single
head again so `alembic upgrade head` works without specifying a branch.

Revision ID: b1c2d3e4f5a6
Revises: a2b3c4d5e6f7, g2h3i4j5k6l7
Create Date: 2026-05-03 17:00:00.000000

"""
from typing import Sequence, Union


revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = ("a2b3c4d5e6f7", "g2h3i4j5k6l7")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No schema changes — this revision exists solely to merge two parallel heads.
    pass


def downgrade() -> None:
    pass
