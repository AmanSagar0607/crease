"""Add AI referral support and bounded crawler request records.

Revision ID: 0011_ai_traffic
Revises: 0010_event_geography
"""
from alembic import op
import sqlalchemy as sa

revision = '0011_ai_traffic'
down_revision = '0010_event_geography'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'projects',
        sa.Column('ai_crawler_key_hash', sa.String(64), nullable=True),
        if_not_exists=True,
    )
    op.create_table(
        'ai_crawler_requests',
        sa.Column('project_id', sa.String(36), nullable=False),
        sa.Column('request_id', sa.String(64), nullable=False),
        sa.Column('requested_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('crawler_name', sa.String(64), nullable=False),
        sa.Column('organization', sa.String(64), nullable=False),
        sa.Column('category', sa.String(32), nullable=False),
        sa.Column('hostname', sa.String(253), nullable=False),
        sa.Column('path', sa.String(512), nullable=False),
        sa.Column('method', sa.String(10), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('user_agent', sa.String(1024), nullable=False),
        sa.Column('detection_method', sa.String(40), nullable=False),
        sa.Column('verification_status', sa.String(24), nullable=False),
        sa.PrimaryKeyConstraint('project_id', 'request_id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    )
    op.create_index(
        'ai_crawler_project_time', 'ai_crawler_requests',
        ['project_id', 'requested_at'], if_not_exists=True,
    )
    op.create_index(
        'ai_crawler_project_name_time', 'ai_crawler_requests',
        ['project_id', 'crawler_name', 'requested_at'], if_not_exists=True,
    )
    op.create_index(
        'ai_crawler_project_path_time', 'ai_crawler_requests',
        ['project_id', 'path', 'requested_at'], if_not_exists=True,
    )


def downgrade():
    op.drop_index('ai_crawler_project_path_time', table_name='ai_crawler_requests')
    op.drop_index('ai_crawler_project_name_time', table_name='ai_crawler_requests')
    op.drop_index('ai_crawler_project_time', table_name='ai_crawler_requests')
    op.drop_table('ai_crawler_requests')
    op.drop_column('projects', 'ai_crawler_key_hash')
