"""Review integrity: dedupe, soft-delete column, edit history.

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-09 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    return column_name in {col['name'] for col in inspector.get_columns(table_name)}


def _constraint_exists(table_name: str, constraint_name: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    for uc in inspector.get_unique_constraints(table_name):
        if uc.get('name') == constraint_name:
            return True
    return False


def upgrade() -> None:
    # Remove duplicate (user_id, book_id) rows, keeping the newest by id.
    op.execute(text("""
        DELETE FROM review
        WHERE id NOT IN (
            SELECT MAX(id) FROM review GROUP BY user_id, book_id
        )
    """))

    if not _column_exists('review', 'is_deleted'):
        with op.batch_alter_table('review') as batch_op:
            batch_op.add_column(
                sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('0'))
            )
        op.create_index('ix_review_is_deleted', 'review', ['is_deleted'], unique=False)

    if not _constraint_exists('review', 'uq_user_book_review'):
        with op.batch_alter_table('review') as batch_op:
            batch_op.create_unique_constraint('uq_user_book_review', ['user_id', 'book_id'])

    op.create_table(
        'review_edit_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('review_id', sa.Integer(), nullable=False),
        sa.Column('previous_rating', sa.Integer(), nullable=False),
        sa.Column('previous_review_text', sa.Text(), nullable=True),
        sa.Column('edited_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['review_id'], ['review.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_review_edit_history_review_id', 'review_edit_history', ['review_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_review_edit_history_review_id', table_name='review_edit_history')
    op.drop_table('review_edit_history')

    if _column_exists('review', 'is_deleted'):
        op.drop_index('ix_review_is_deleted', table_name='review')
        with op.batch_alter_table('review') as batch_op:
            batch_op.drop_column('is_deleted')
