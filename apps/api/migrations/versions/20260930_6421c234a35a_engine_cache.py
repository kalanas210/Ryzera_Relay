"""engine cache

Revision ID: 6421c234a35a
Revises: 8407b1eae16e
Create Date: 2026-09-30 19:23:44.016014+05:30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '6421c234a35a'
down_revision: str | None = '8407b1eae16e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('engine_cache',
    sa.Column('key', sa.String(length=64), nullable=False),
    sa.Column('depot', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.PrimaryKeyConstraint('key', name=op.f('pk_engine_cache'))
    )


def downgrade() -> None:
    op.drop_table('engine_cache')
