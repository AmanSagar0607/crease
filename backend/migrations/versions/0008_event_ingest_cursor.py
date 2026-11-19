"""Add a stable ingestion cursor for live event delivery.

Revision ID: 0008_event_ingest_cursor
Revises: 0007_clerk_profiles
"""
from alembic import op
import sqlalchemy as sa

revision = '0008_event_ingest_cursor'
down_revision = '0007_clerk_profiles'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('events', sa.Column('ingest_seq', sa.BigInteger(), sa.Identity(always=False), nullable=False))
    op.create_index('events_project_ingest_seq', 'events', ['project_id', 'ingest_seq'])


def downgrade():
    op.drop_index('events_project_ingest_seq', table_name='events')
    op.drop_column('events', 'ingest_seq')
