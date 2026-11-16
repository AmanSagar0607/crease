"""Add project-scoped acquisition touchpoints.

Revision ID: 0003_attribution_touchpoints
Revises: 0002_property_filters
"""
from alembic import op
import sqlalchemy as sa

revision = '0003_attribution_touchpoints'
down_revision = '0002_property_filters'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'attribution_touchpoints',
        sa.Column('project_id', sa.String(36), nullable=False),
        sa.Column('event_id', sa.String(64), nullable=False),
        sa.Column('visitor_id', sa.String(64), nullable=False),
        sa.Column('session_id', sa.String(64), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('landing_page', sa.String(512), nullable=False),
        sa.Column('referrer_domain', sa.String(253)),
        sa.Column('utm_source', sa.String(128)),
        sa.Column('utm_medium', sa.String(128)),
        sa.Column('utm_campaign', sa.String(128)),
        sa.Column('utm_content', sa.String(128)),
        sa.Column('utm_term', sa.String(128)),
        sa.PrimaryKeyConstraint('project_id', 'event_id'),
        sa.ForeignKeyConstraint(['project_id', 'event_id'], ['events.project_id', 'events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    )
    op.create_index('touchpoints_visitor_time', 'attribution_touchpoints', ['project_id', 'visitor_id', 'occurred_at'])
    op.create_index('touchpoints_project_time', 'attribution_touchpoints', ['project_id', 'occurred_at'])


def downgrade():
    op.drop_index('touchpoints_project_time', table_name='attribution_touchpoints')
    op.drop_index('touchpoints_visitor_time', table_name='attribution_touchpoints')
    op.drop_table('attribution_touchpoints')
