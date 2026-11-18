"""Add Clerk identity profiles without altering legacy ownership.

Revision ID: 0007_clerk_profiles
Revises: 0006_waitlist
"""
from alembic import op
import sqlalchemy as sa

revision = '0007_clerk_profiles'
down_revision = '0006_waitlist'
branch_labels = None
depends_on = None


def upgrade():
    # Existing IDs remain byte-for-byte unchanged; widen columns for Clerk subject identifiers.
    for table in ('projects', 'github_connections', 'vercel_connections', 'project_vercel'):
        op.alter_column(table, 'user_id', existing_type=sa.String(64), type_=sa.String(255), existing_nullable=False)
    op.create_table(
        'clerk_profiles',
        sa.Column('clerk_id', sa.String(255), primary_key=True),
        sa.Column('display_handle', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    # Reverting requires all Clerk IDs to fit the legacy width; refuse rather than truncate.
    op.drop_table('clerk_profiles')
    for table in ('project_vercel', 'vercel_connections', 'github_connections', 'projects'):
        op.alter_column(table, 'user_id', existing_type=sa.String(255), type_=sa.String(64), existing_nullable=False)
