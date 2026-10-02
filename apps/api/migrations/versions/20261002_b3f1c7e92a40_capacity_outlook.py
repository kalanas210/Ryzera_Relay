"""capacity outlook

Revision ID: b3f1c7e92a40
Revises: 5d2c8e41a7b3
Create Date: 2026-10-02 10:30:00.000000+05:30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'b3f1c7e92a40'
down_revision: str | None = '5d2c8e41a7b3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('outlook_forecast',
    sa.Column('depot', sa.String(length=16), nullable=False),
    sa.Column('forecast_updated', sa.Date(), nullable=False),
    sa.Column('baseline_year', sa.SmallInteger(), nullable=False),
    sa.Column('baseline_first_week', sa.SmallInteger(), nullable=False),
    sa.Column('baseline_last_week', sa.SmallInteger(), nullable=False),
    sa.Column('backtest_year', sa.SmallInteger(), nullable=False),
    sa.Column('backtest_first_week', sa.SmallInteger(), nullable=False),
    sa.Column('backtest_last_week', sa.SmallInteger(), nullable=False),
    sa.Column('backtest_pct', sa.Numeric(precision=4, scale=1, asdecimal=False), nullable=False),
    sa.Column('last_year_pct', sa.Numeric(precision=4, scale=1, asdecimal=False), nullable=False),
    sa.Column('ordinary_week_m3', sa.Numeric(precision=7, scale=1, asdecimal=False), nullable=False),
    sa.Column('record_week_m3', sa.Numeric(precision=7, scale=1, asdecimal=False), nullable=False),
    sa.Column('record_year', sa.SmallInteger(), nullable=False),
    sa.Column('record_week', sa.SmallInteger(), nullable=False),
    sa.Column('tech_order_max_m3', sa.Numeric(precision=6, scale=1, asdecimal=False), nullable=False),
    sa.PrimaryKeyConstraint('depot', name=op.f('pk_outlook_forecast'))
    )
    op.create_table('outlook_week',
    sa.Column('depot', sa.String(length=16), nullable=False),
    sa.Column('iso_year', sa.SmallInteger(), nullable=False),
    sa.Column('iso_week', sa.SmallInteger(), nullable=False),
    sa.Column('chilled_m3', sa.Numeric(precision=7, scale=1, asdecimal=False), nullable=False),
    sa.Column('dry_m3', sa.Numeric(precision=7, scale=1, asdecimal=False), nullable=False),
    sa.Column('style_m3', sa.Numeric(precision=7, scale=1, asdecimal=False), nullable=False),
    sa.Column('tech_m3', sa.Numeric(precision=7, scale=1, asdecimal=False), nullable=False),
    sa.ForeignKeyConstraint(['depot'], ['outlook_forecast.depot'], name=op.f('fk_outlook_week_depot_outlook_forecast')),
    sa.PrimaryKeyConstraint('depot', 'iso_year', 'iso_week', name=op.f('pk_outlook_week'))
    )
    op.create_table('outlook_day',
    sa.Column('depot', sa.String(length=16), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('chilled_orders', sa.SmallInteger(), nullable=False),
    sa.Column('chilled_kg', sa.Numeric(precision=8, scale=1, asdecimal=False), nullable=False),
    sa.Column('chilled_m3', sa.Numeric(precision=6, scale=1, asdecimal=False), nullable=False),
    sa.Column('needed', sa.SmallInteger(), nullable=False),
    sa.Column('in_workshop', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('served_one_fewer', sa.SmallInteger(), nullable=True),
    sa.ForeignKeyConstraint(['depot'], ['outlook_forecast.depot'], name=op.f('fk_outlook_day_depot_outlook_forecast')),
    sa.PrimaryKeyConstraint('depot', 'date', name=op.f('pk_outlook_day'))
    )


def downgrade() -> None:
    op.drop_table('outlook_day')
    op.drop_table('outlook_week')
    op.drop_table('outlook_forecast')
