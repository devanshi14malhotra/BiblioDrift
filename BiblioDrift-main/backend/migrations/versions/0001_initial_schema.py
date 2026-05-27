"""Initial schema — all BiblioDrift models

Revision ID: 0001
Revises:
Create Date: 2026-05-10 00:00:00.000000

This migration captures the full database schema as it exists at the point
Flask-Migrate was introduced. All subsequent schema changes must be made
through new migration scripts generated with:

    flask db migrate -m "description of change"
    flask db upgrade

To roll back this migration (drops all tables):

    flask db downgrade base
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── user ──────────────────────────────────────────────────────────────────
    op.create_table(
        'user',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username'),
    )

    # ── book ──────────────────────────────────────────────────────────────────
    op.create_table(
        'book',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('google_books_id', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('authors', sa.String(length=500), nullable=True),
        sa.Column('thumbnail', sa.String(length=500), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('categories', sa.String(length=255), nullable=True),
        sa.Column('average_rating', sa.Float(), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('google_books_id'),
    )

    # ── book_note ─────────────────────────────────────────────────────────────
    op.create_table(
        'book_note',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('book_title', sa.String(length=255), nullable=False),
        sa.Column('book_author', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'idx_book_note_title_author',
        'book_note',
        ['book_title', 'book_author'],
        unique=False,
    )

    # ── collection ────────────────────────────────────────────────────────────
    op.create_table(
        'collection',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_user_collection_name'),
    )

    # ── reading_goal ──────────────────────────────────────────────────────────
    op.create_table(
        'reading_goal',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('target_books', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'year', name='uq_user_year_goal'),
    )

    # ── reading_stats ─────────────────────────────────────────────────────────
    op.create_table(
        'reading_stats',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('books_completed', sa.Integer(), nullable=True),
        sa.Column('pages_read', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'year', 'month', name='uq_user_year_month_stats'),
    )

    # ── shelf_item ────────────────────────────────────────────────────────────
    op.create_table(
        'shelf_item',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('book_id', sa.Integer(), nullable=False),
        sa.Column(
            'shelf_type',
            sa.Enum('want', 'current', 'finished', name='shelf_item_types'),
            nullable=False,
        ),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('price_alert', sa.Boolean(), nullable=True),
        sa.Column('target_price', sa.Float(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['book_id'], ['book.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── collection_item ───────────────────────────────────────────────────────
    op.create_table(
        'collection_item',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('collection_id', sa.Integer(), nullable=False),
        sa.Column('book_id', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['book_id'], ['book.id']),
        sa.ForeignKeyConstraint(['collection_id'], ['collection.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('collection_id', 'book_id', name='uq_collection_book'),
    )

    # ── price_history ─────────────────────────────────────────────────────────
    op.create_table(
        'price_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('book_id', sa.Integer(), nullable=False),
        sa.Column('retailer', sa.String(length=50), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=True),
        sa.Column('checked_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['book_id'], ['book.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'idx_price_history_book_retailer',
        'price_history',
        ['book_id', 'retailer'],
        unique=False,
    )
    op.create_index(
        'idx_price_history_checked_at',
        'price_history',
        ['checked_at'],
        unique=False,
    )

    # ── price_alert ───────────────────────────────────────────────────────────
    op.create_table(
        'price_alert',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('shelf_item_id', sa.Integer(), nullable=False),
        sa.Column('target_price', sa.Float(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('notified_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['shelf_item_id'], ['shelf_item.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'shelf_item_id', name='uq_user_shelf_item_alert'),
    )

    # ── review ────────────────────────────────────────────────────────────────
    op.create_table(
        'review',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('book_id', sa.Integer(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('review_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['book_id'], ['book.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'book_id', name='uq_user_book_review'),
    )
    op.create_index('idx_review_book_id', 'review', ['book_id'], unique=False)
    op.create_index('idx_review_user_id', 'review', ['user_id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_index('idx_review_user_id', table_name='review')
    op.drop_index('idx_review_book_id', table_name='review')
    op.drop_table('review')

    op.drop_table('price_alert')

    op.drop_index('idx_price_history_checked_at', table_name='price_history')
    op.drop_index('idx_price_history_book_retailer', table_name='price_history')
    op.drop_table('price_history')

    op.drop_table('collection_item')
    op.drop_table('shelf_item')
    op.drop_table('reading_stats')
    op.drop_table('reading_goal')
    op.drop_table('collection')
    op.drop_index('idx_book_note_title_author', table_name='book_note')
    op.drop_table('book_note')
    op.drop_table('book')
    op.drop_table('user')

    # Drop the shelf_item_types enum (PostgreSQL only — SQLite ignores this)
    op.execute("DROP TYPE IF EXISTS shelf_item_types")
