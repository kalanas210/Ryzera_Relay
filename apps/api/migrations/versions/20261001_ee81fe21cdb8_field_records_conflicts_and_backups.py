"""field records conflicts and backups

Revision ID: ee81fe21cdb8
Revises: 6421c234a35a
Create Date: 2026-10-01 21:39:43.839595+05:30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'ee81fe21cdb8'
down_revision: str | None = '6421c234a35a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('conflict', sa.Column('event_id', sa.Uuid(), nullable=True))
    op.add_column('conflict', sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('conflict', sa.Column('resolved_by', sa.Uuid(), nullable=True))
    op.add_column('conflict', sa.Column('escalated_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(op.f('fk_conflict_resolved_by_app_user'), 'conflict', 'app_user', ['resolved_by'], ['id'])
    op.add_column('device_contact', sa.Column('device_id', sa.String(length=64), nullable=True))
    op.add_column('device_contact', sa.Column('gap_from', sa.DateTime(timezone=True), nullable=True))
    op.add_column('device_contact', sa.Column('gap_to', sa.DateTime(timezone=True), nullable=True))
    op.add_column('field_event', sa.Column('applied_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('field_event', sa.Column('reject_reason', sa.Text(), nullable=False, server_default=''))
    op.add_column('notification', sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('photo', sa.Column('stop_id', sa.Uuid(), nullable=True))
    op.add_column('photo', sa.Column('event_id', sa.Uuid(), nullable=True))
    op.create_index(op.f('ix_photo_stop_id'), 'photo', ['stop_id'], unique=False)
    op.create_foreign_key(op.f('fk_photo_stop_id_stop'), 'photo', 'stop', ['stop_id'], ['id'], ondelete='CASCADE')
    op.add_column('problem_report', sa.Column('lines', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'))
    op.add_column('problem_report', sa.Column('urgent', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('trip', sa.Column('turned_back_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('trip', 'turned_back_at')
    op.drop_column('problem_report', 'urgent')
    op.drop_column('problem_report', 'lines')
    op.drop_constraint(op.f('fk_photo_stop_id_stop'), 'photo', type_='foreignkey')
    op.drop_index(op.f('ix_photo_stop_id'), table_name='photo')
    op.drop_column('photo', 'event_id')
    op.drop_column('photo', 'stop_id')
    op.drop_column('notification', 'delivered_at')
    op.drop_column('field_event', 'reject_reason')
    op.drop_column('field_event', 'applied_at')
    op.drop_column('device_contact', 'gap_to')
    op.drop_column('device_contact', 'gap_from')
    op.drop_column('device_contact', 'device_id')
    op.drop_constraint(op.f('fk_conflict_resolved_by_app_user'), 'conflict', type_='foreignkey')
    op.drop_column('conflict', 'escalated_at')
    op.drop_column('conflict', 'resolved_by')
    op.drop_column('conflict', 'resolved_at')
    op.drop_column('conflict', 'event_id')
