"""Add password_reset_token table.

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-18 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'password_reset_token',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash'),
    )
    op.create_index('ix_password_reset_token_user_id', 'password_reset_token', ['user_id'], unique=False)
    op.create_index('ix_password_reset_token_token_hash', 'password_reset_token', ['token_hash'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_password_reset_token_token_hash', table_name='password_reset_token')
    op.drop_index('ix_password_reset_token_user_id', table_name='password_reset_token')
    op.drop_table('password_reset_token')
