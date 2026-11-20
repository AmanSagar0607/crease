"""Store normalized browser and operating system families on events.

Revision ID: 0009_event_browser_os
Revises: 0008_event_ingest_cursor
"""
from alembic import op
import sqlalchemy as sa

revision = '0009_event_browser_os'
down_revision = '0008_event_ingest_cursor'
branch_labels = None
depends_on = None


def upgrade():
    # The production schema may be prepared before the application deploy. Make
    # the Alembic step safe to run after that schema preparation as well.
    op.add_column('events', sa.Column('browser', sa.String(64), nullable=True), if_not_exists=True)
    op.add_column('events', sa.Column('operating_system', sa.String(64), nullable=True), if_not_exists=True)


def downgrade():
    op.drop_column('events', 'operating_system')
    op.drop_column('events', 'browser')
