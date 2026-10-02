"""hub stock

Revision ID: 5d2c8e41a7b3
Revises: ee81fe21cdb8
Create Date: 2026-10-01 23:10:00.000000+05:30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '5d2c8e41a7b3'
down_revision: str | None = 'ee81fe21cdb8'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('hub_stock',
    sa.Column('depot', sa.String(length=16), nullable=False),
    sa.Column('case_type', sa.String(length=24), nullable=False),
    sa.Column('run_date', sa.Date(), nullable=False),
    sa.Column('spare', sa.Integer(), nullable=False),
    sa.Column('next_delivery_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['case_type'], ['case_type.code'], name=op.f('fk_hub_stock_case_type_case_type')),
    sa.PrimaryKeyConstraint('depot', 'case_type', 'run_date', name=op.f('pk_hub_stock'))
    )


def downgrade() -> None:
    op.drop_table('hub_stock')
