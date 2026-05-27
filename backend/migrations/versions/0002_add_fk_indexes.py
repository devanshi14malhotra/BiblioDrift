"""Add indexes for frequently queried foreign key columns.

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-11 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_shelf_item_user_id', 'shelf_item', ['user_id'], unique=False)
    op.create_index('ix_shelf_item_book_id', 'shelf_item', ['book_id'], unique=False)

    op.create_index('ix_reading_goal_user_id', 'reading_goal', ['user_id'], unique=False)
    op.create_index('ix_reading_stats_user_id', 'reading_stats', ['user_id'], unique=False)
    op.create_index('ix_collection_user_id', 'collection', ['user_id'], unique=False)

    op.create_index('ix_collection_item_collection_id', 'collection_item', ['collection_id'], unique=False)
    op.create_index('ix_collection_item_book_id', 'collection_item', ['book_id'], unique=False)

    op.create_index('ix_price_history_book_id', 'price_history', ['book_id'], unique=False)

    op.create_index('ix_price_alert_user_id', 'price_alert', ['user_id'], unique=False)
    op.create_index('ix_price_alert_shelf_item_id', 'price_alert', ['shelf_item_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_price_alert_shelf_item_id', table_name='price_alert')
    op.drop_index('ix_price_alert_user_id', table_name='price_alert')

    op.drop_index('ix_price_history_book_id', table_name='price_history')

    op.drop_index('ix_collection_item_book_id', table_name='collection_item')
    op.drop_index('ix_collection_item_collection_id', table_name='collection_item')

    op.drop_index('ix_collection_user_id', table_name='collection')
    op.drop_index('ix_reading_stats_user_id', table_name='reading_stats')
    op.drop_index('ix_reading_goal_user_id', table_name='reading_goal')

    op.drop_index('ix_shelf_item_book_id', table_name='shelf_item')
    op.drop_index('ix_shelf_item_user_id', table_name='shelf_item')
