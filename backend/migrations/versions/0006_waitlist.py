"""Store consented Crease waitlist signups.

Revision ID: 0006_waitlist
Revises: 0005_project_goals
"""
from alembic import op
import sqlalchemy as sa

revision = '0006_waitlist'
down_revision = '0005_project_goals'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'waitlist_signups',
        sa.Column('email', sa.String(254), primary_key=True),
        sa.Column('consented_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table('waitlist_signups')
