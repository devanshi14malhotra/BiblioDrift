"""
Alembic environment configuration for BiblioDrift.

This file is loaded by Alembic (via Flask-Migrate) when running migration
commands. It connects Alembic to the Flask application context so that:
  - The correct database URL is used (from SQLALCHEMY_DATABASE_URI)
  - All SQLAlchemy models are visible for autogenerate
  - Both online (live DB) and offline (SQL script) modes are supported
"""

import logging
from logging.config import fileConfig

from flask import current_app
from alembic import context

# Alembic Config object — provides access to values in alembic.ini
config = context.config

# Set up Python logging from the alembic.ini [loggers] section
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger('alembic.env')


def get_engine():
    """Return the SQLAlchemy engine from the current Flask app."""
    try:
        # Flask-SQLAlchemy >= 3.x
        return current_app.extensions['migrate'].db.get_engine()
    except (TypeError, AttributeError):
        # Fallback for older versions
        return current_app.extensions['migrate'].db.engine


def get_engine_url():
    """Return the database URL string for Alembic configuration."""
    try:
        return get_engine().url.render_as_string(hide_password=False).replace('%', '%%')
    except AttributeError:
        return str(get_engine().url).replace('%', '%%')


# Override the sqlalchemy.url in alembic.ini with the app's actual DB URL
config.set_main_option('sqlalchemy.url', get_engine_url())

# Retrieve the MetaData object from the Flask-Migrate extension.
# This is what Alembic uses to detect schema changes for autogenerate.
target_db = current_app.extensions['migrate'].db


def get_metadata():
    """Return the SQLAlchemy MetaData for autogenerate support."""
    if hasattr(target_db, 'metadatas'):
        return target_db.metadatas[None]
    return target_db.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    In offline mode Alembic does not connect to the database — it generates
    a SQL script that can be reviewed and applied manually. Useful for
    production deployments where direct DB access is restricted.
    """
    url = config.get_main_option('sqlalchemy.url')
    context.configure(
        url=url,
        target_metadata=get_metadata(),
        literal_binds=True,
        dialect_opts={'paramstyle': 'named'},
        # Compare server defaults so Alembic detects DEFAULT value changes
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.

    In online mode Alembic connects directly to the database and applies
    migrations immediately. This is the standard mode for development and
    automated deployment pipelines.
    """

    def process_revision_directives(context, revision, directives):
        """Prevent generating empty migration files."""
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info('No schema changes detected — skipping empty migration.')

    conf_args = current_app.extensions['migrate'].configure_args
    if conf_args.get('process_revision_directives') is None:
        conf_args['process_revision_directives'] = process_revision_directives

    connectable = get_engine()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=get_metadata(),
            compare_server_default=True,
            **conf_args,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
