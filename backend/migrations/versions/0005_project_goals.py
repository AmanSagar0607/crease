"""Add project-scoped event count goals.

Revision ID: 0005_project_goals
Revises: 0004_payment_foundation
"""
from alembic import op
import sqlalchemy as sa

revision = '0005_project_goals'
down_revision = '0004_payment_foundation'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'project_goals',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('event_name', sa.String(64), nullable=False),
        sa.Column('target_count', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('project_id', 'name', name='project_goal_project_name'),
        sa.CheckConstraint('target_count > 0', name='project_goal_positive_target'),
    )
    op.create_index('project_goals_project_event', 'project_goals', ['project_id', 'event_name'])


def downgrade():
    op.drop_index('project_goals_project_event', table_name='project_goals')
    op.drop_table('project_goals')
