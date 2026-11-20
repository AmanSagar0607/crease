"""Store Cloudflare-derived event location snapshots and forwarding nonces.

Revision ID: 0010_event_geography
Revises: 0009_event_browser_os
"""
from alembic import op
import sqlalchemy as sa

revision = '0010_event_geography'
down_revision = '0009_event_browser_os'
branch_labels = None
depends_on = None


def upgrade():
    columns = (
        ('country_name', sa.String(96)),
        ('region_code', sa.String(32)),
        ('region_name', sa.String(128)),
        ('city_name', sa.String(128)),
        ('continent_code', sa.String(2)),
        ('timezone', sa.String(64)),
        ('latitude', sa.Float()),
        ('longitude', sa.Float()),
        ('postal_code', sa.String(24)),
        ('geo_source', sa.String(24)),
    )
    for name, type_ in columns:
        op.add_column('events', sa.Column(name, type_, nullable=True), if_not_exists=True)
    op.create_index('events_project_country_time', 'events', ['project_id', 'country', 'occurred_at'], if_not_exists=True)
    op.create_index('events_project_region_time', 'events', ['project_id', 'country', 'region_code', 'occurred_at'], if_not_exists=True)
    op.create_index('events_project_city_time', 'events', ['project_id', 'country', 'region_code', 'city_name', 'occurred_at'], if_not_exists=True)
    op.create_table(
        'geo_forward_replays',
        sa.Column('nonce', sa.String(64), primary_key=True),
        sa.Column('issued_at', sa.BigInteger(), nullable=False),
    )
    op.create_index('geo_forward_replays_issued_at', 'geo_forward_replays', ['issued_at'])


def downgrade():
    op.drop_index('geo_forward_replays_issued_at', table_name='geo_forward_replays')
    op.drop_table('geo_forward_replays')
    for index in ('events_project_city_time', 'events_project_region_time', 'events_project_country_time'):
        op.drop_index(index, table_name='events')
    for name in ('geo_source', 'postal_code', 'longitude', 'latitude', 'timezone', 'continent_code', 'city_name', 'region_name', 'region_code', 'country_name'):
        op.drop_column('events', name)
