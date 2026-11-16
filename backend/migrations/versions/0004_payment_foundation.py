"""Payment integration storage and idempotent provider events.

Revision ID: 0004_payment_foundation
Revises: 0003_attribution_touchpoints
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_payment_foundation'
down_revision = '0003_attribution_touchpoints'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('payment_integrations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(32), nullable=False),
        sa.Column('live_mode', sa.Boolean(), nullable=False),
        sa.Column('encrypted_signing_secret', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_verified_event_at', sa.DateTime(timezone=True)),
        sa.UniqueConstraint('project_id', 'provider', name='payment_integration_project_provider'),
    )
    op.create_table('payment_webhook_events',
        sa.Column('integration_id', sa.String(36), sa.ForeignKey('payment_integrations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider_event_id', sa.String(255), nullable=False),
        sa.Column('event_type', sa.String(128), nullable=False),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('integration_id', 'provider_event_id'),
    )
    op.create_table('payments',
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(32), nullable=False),
        sa.Column('live_mode', sa.Boolean(), nullable=False),
        sa.Column('provider_transaction_id', sa.String(255), nullable=False),
        sa.Column('provider_customer_id', sa.String(255)),
        sa.Column('amount_minor', sa.BigInteger(), nullable=False),
        sa.Column('refunded_minor', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(3), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('project_id','provider','live_mode','provider_transaction_id'),
        sa.CheckConstraint('amount_minor >= 0 AND refunded_minor >= 0 AND refunded_minor <= amount_minor', name='payment_amount_bounds'),
    )
    op.create_index('payments_project_time', 'payments', ['project_id','occurred_at'])


def downgrade():
    op.drop_index('payments_project_time', table_name='payments')
    op.drop_table('payments')
    op.drop_table('payment_webhook_events')
    op.drop_table('payment_integrations')
