"""Add bookmarks table

Revision ID: 0003
Revises: 0002_add_fk_indexes
Create Date: 2026-05-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0002_add_fk_indexes'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'bookmark',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('book_id', sa.Integer(), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='0'),
        sa.CheckConstraint('page_number IS NULL OR page_number > 0', name='check_page_number_positive'),
        sa.ForeignKeyConstraint(['book_id'], ['book.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'book_id', name='unique_user_book_bookmark')
    )
    op.create_index('ix_bookmark_user_id', 'bookmark', ['user_id'], unique=False)
    op.create_index('ix_bookmark_book_id', 'bookmark', ['book_id'], unique=False)


def downgrade():
    op.drop_index('ix_bookmark_book_id', table_name='bookmark')
    op.drop_index('ix_bookmark_user_id', table_name='bookmark')
    op.drop_table('bookmark')