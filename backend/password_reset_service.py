"""Password reset token issuance and consumption."""
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError

from sqlalchemy import func

try:
    from .models import PasswordResetToken, User, db
except ImportError:
    from models import PasswordResetToken, User, db

logger = logging.getLogger(__name__)

RESET_TOKEN_BYTES = 32
RESET_TOKEN_TTL = timedelta(hours=1)

FORGOT_PASSWORD_MESSAGE = (
    "If an account exists for that email, password reset instructions have been sent."
)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _invalidate_active_tokens(user_id: int) -> None:
    now = _utcnow()
    (
        PasswordResetToken.query.filter_by(user_id=user_id)
        .filter(PasswordResetToken.used_at.is_(None))
        .update({'used_at': now}, synchronize_session=False)
    )


def create_password_reset_token(user: User) -> str:
    """Create a new reset token for the user; returns the plaintext token."""
    plain_token = secrets.token_urlsafe(RESET_TOKEN_BYTES)
    record = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_token(plain_token),
        expires_at=_utcnow() + RESET_TOKEN_TTL,
    )
    _invalidate_active_tokens(user.id)
    db.session.add(record)
    db.session.commit()
    return plain_token


def reset_password_with_token(token: str, new_password: str) -> tuple[bool, str]:
    """Validate token and set a new password. Returns (success, message)."""
    if not token or not token.strip():
        return False, "Invalid or expired reset link."

    token_hash = _hash_token(token.strip())
    record = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
    now = _utcnow()

    if not record or record.used_at is not None:
        return False, "Invalid or expired reset link."

    expires = record.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if expires < now:
        return False, "Invalid or expired reset link."

    user = User.query.get(record.user_id)
    if not user:
        return False, "Invalid or expired reset link."

    try:
        user.set_password(new_password)
        record.used_at = now
        db.session.commit()
        return True, "Password updated successfully. You can sign in with your new password."
    except SQLAlchemyError as exc:
        db.session.rollback()
        logger.error("Password reset failed for user %s: %s", user.id, exc)
        return False, "Unable to reset password. Please try again later."


def request_password_reset(email: str) -> Optional[str]:
    """
    Start reset flow for a local account email.
    Returns plaintext token when a matching user exists, else None.
    """
    normalized = email.strip().lower()
    user = User.query.filter(func.lower(User.email) == normalized).first()
    if not user:
        return None
    return create_password_reset_token(user)
