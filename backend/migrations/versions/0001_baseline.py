"""Baseline schema matching the pre-Alembic Crease database.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-11-16
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_baseline'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('github_id', sa.String(64), nullable=False, unique=True),
        sa.Column('login', sa.String(255), nullable=False),
    )
    op.create_table(
        'sessions',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('user_id', sa.String(64), nullable=False),
        sa.Column('expires_at', sa.String(32), nullable=False),
    )
    op.create_table(
        'oauth_states',
        sa.Column('state_hash', sa.String(64), primary_key=True),
        sa.Column('expires_at', sa.String(32), nullable=False),
    )
    op.create_table(
        'projects',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(64), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('domain', sa.String(253), nullable=False),
        sa.Column('retention_days', sa.Integer(), nullable=False, server_default=sa.text('90')),
        sa.Column('write_key_hash', sa.String(64), nullable=True),
        sa.Column('verification_token', sa.String(64), nullable=True),
        sa.Column('verified_at', sa.String(32), nullable=True),
    )
    op.create_table(
        'project_repositories',
        sa.Column('project_id', sa.String(36), primary_key=True),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('installation_id', sa.BigInteger(), nullable=False),
    )
    op.create_table(
        'github_connections',
        sa.Column('user_id', sa.String(64), primary_key=True),
        sa.Column('encrypted_token', sa.Text(), nullable=False),
    )
    op.create_table(
        'vercel_connections',
        sa.Column('user_id', sa.String(64), primary_key=True),
        sa.Column('encrypted_token', sa.Text(), nullable=False),
        sa.Column('team_id', sa.String(128), nullable=True),
    )
    op.create_table(
        'project_vercel',
        sa.Column('project_id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(64), nullable=False),
        sa.Column('vercel_project_id', sa.String(128), nullable=False),
    )
    op.create_table(
        'events',
        sa.Column('project_id', sa.String(36), nullable=False),
        sa.Column('id', sa.String(64), nullable=False),
        sa.Column('name', sa.String(64), nullable=False),
        sa.Column('occurred_at', sa.String(40), nullable=False),
        sa.Column('path', sa.String(512), nullable=False),
        sa.Column('visitor_id', sa.String(64), nullable=True),
        sa.Column('session_id', sa.String(64), nullable=True),
        sa.Column('country', sa.String(2), nullable=True),
        sa.Column('device', sa.String(16), nullable=True),
        sa.Column('referrer', sa.String(253), nullable=True),
        sa.Column('properties', sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint('project_id', 'id'),
    )
    op.create_index('events_project_time', 'events', ['project_id', 'occurred_at'])
    op.create_table(
        'analytics_sessions',
        sa.Column('project_id', sa.String(36), nullable=False),
        sa.Column('session_id', sa.String(64), nullable=False),
        sa.Column('visitor_id', sa.String(64), nullable=True),
        sa.Column('started_at', sa.String(40), nullable=False),
        sa.Column('last_activity_at', sa.String(40), nullable=False),
        sa.Column('entry_page', sa.String(512), nullable=False),
        sa.Column('exit_page', sa.String(512), nullable=False),
        sa.Column('pageview_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.PrimaryKeyConstraint('project_id', 'session_id'),
    )
    op.create_index('analytics_sessions_project_time', 'analytics_sessions', ['project_id', 'started_at'])
    op.create_table(
        'rate_limits',
        sa.Column('bucket', sa.String(160), primary_key=True),
        sa.Column('window_start', sa.BigInteger(), nullable=False),
        sa.Column('hits', sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table('rate_limits')
    op.drop_index('analytics_sessions_project_time', table_name='analytics_sessions')
    op.drop_table('analytics_sessions')
    op.drop_index('events_project_time', table_name='events')
    op.drop_table('events')
    op.drop_table('project_vercel')
    op.drop_table('vercel_connections')
    op.drop_table('github_connections')
    op.drop_table('project_repositories')
    op.drop_table('projects')
    op.drop_table('oauth_states')
    op.drop_table('sessions')
    op.drop_table('users')
