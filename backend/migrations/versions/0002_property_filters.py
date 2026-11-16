"""Index event properties and track declared property keys.

Revision ID: 0002_property_filters
Revises: 0001_baseline
Create Date: 2026-11-16
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_property_filters'
down_revision = '0001_baseline'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'event_properties',
        sa.Column('project_id', sa.String(36), nullable=False),
        sa.Column('event_id', sa.String(64), nullable=False),
        sa.Column('name', sa.String(64), nullable=False),
        sa.Column('value_text', sa.String(256), nullable=True),
        sa.Column('value_number', sa.Float(), nullable=True),
        sa.Column('value_boolean', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('project_id', 'event_id', 'name'),
    )
    op.create_index('event_properties_text_lookup', 'event_properties', ['project_id', 'name', 'value_text'])
    op.create_index('event_properties_number_lookup', 'event_properties', ['project_id', 'name', 'value_number'])
    op.create_table(
        'project_property_keys',
        sa.Column('project_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(64), nullable=False),
        sa.Column('value_type', sa.String(16), nullable=False),
        sa.Column('first_seen_at', sa.String(40), nullable=False),
        sa.Column('last_seen_at', sa.String(40), nullable=False),
        sa.PrimaryKeyConstraint('project_id', 'name'),
    )
    # The JSON text column predates this table. Backfill the indexed rows on
    # PostgreSQL so existing events are filterable immediately.
    if op.get_bind().dialect.name == 'postgresql':
        op.execute('''
            INSERT INTO event_properties (project_id,event_id,name,value_text,value_number,value_boolean)
            SELECT e.project_id, e.id, p.key,
                p.value #>> '{}',
                CASE WHEN jsonb_typeof(p.value) = 'number' THEN (p.value #>> '{}')::double precision END,
                CASE WHEN jsonb_typeof(p.value) = 'boolean' THEN (p.value #>> '{}')::boolean END
            FROM events e, jsonb_each(e.properties::jsonb) AS p(key, value)
            WHERE jsonb_typeof(p.value) IN ('number','boolean')
              AND p.key ~ '^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$'
            ON CONFLICT (project_id,event_id,name) DO NOTHING
        ''')
        op.execute('''
            INSERT INTO project_property_keys (project_id,name,value_type,first_seen_at,last_seen_at)
            SELECT project_id, name,
                CASE WHEN COUNT(DISTINCT value_type) > 1 THEN 'mixed' ELSE MIN(value_type) END,
                MIN(first_seen_at), MAX(last_seen_at)
            FROM (
                SELECT ep.project_id, ep.name,
                    CASE WHEN ep.value_boolean IS NOT NULL THEN 'boolean' ELSE 'number' END AS value_type,
                    e.occurred_at AS first_seen_at, e.occurred_at AS last_seen_at
                FROM event_properties ep
                JOIN events e ON e.project_id=ep.project_id AND e.id=ep.event_id
            ) AS observed
            GROUP BY project_id, name
            ON CONFLICT (project_id,name) DO UPDATE SET
                value_type=excluded.value_type,
                first_seen_at=LEAST(project_property_keys.first_seen_at,excluded.first_seen_at),
                last_seen_at=GREATEST(project_property_keys.last_seen_at,excluded.last_seen_at)
        ''')


def downgrade():
    op.drop_table('project_property_keys')
    op.drop_index('event_properties_number_lookup', table_name='event_properties')
    op.drop_index('event_properties_text_lookup', table_name='event_properties')
    op.drop_table('event_properties')
