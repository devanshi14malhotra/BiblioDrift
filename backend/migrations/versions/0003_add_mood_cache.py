"""Add database-backed mood cache.

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-18 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'mood_cache',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cache_key', sa.String(length=512), nullable=False),
        sa.Column('book_title', sa.String(length=255), nullable=False),
        sa.Column('book_author', sa.String(length=255), nullable=False),
        sa.Column('analysis_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cache_key', name='uq_mood_cache_key'),
    )
    op.create_index('ix_mood_cache_cache_key', 'mood_cache', ['cache_key'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_mood_cache_cache_key', table_name='mood_cache')
    op.drop_table('mood_cache')