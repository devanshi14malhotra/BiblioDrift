"""Outbound email delivery for password reset and other transactional mail."""
from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Optional
from urllib.parse import quote

import requests

try:
    from .config import EmailConfig
except ImportError:
    from config import EmailConfig

logger = logging.getLogger(__name__)

SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send'
PASSWORD_RESET_SUBJECT = 'Reset your BiblioDrift password'


@dataclass(frozen=True)
class EmailSendResult:
    """Result of an email send attempt."""

    ok: bool
    detail: str = ''


def is_email_configured(config: EmailConfig) -> bool:
    """Return True when enough settings exist to send mail for the chosen provider."""
    if not config.from_email or not str(config.from_email).strip():
        return False

    provider = (config.service_provider or 'sendgrid').strip().lower()
    if provider == 'sendgrid':
        return bool(config.api_key and str(config.api_key).strip())
    if provider == 'smtp':
        return bool(config.smtp_host and str(config.smtp_host).strip())
    logger.warning("Unknown EMAIL_SERVICE '%s'; email disabled.", provider)
    return False


def build_password_reset_url(plain_token: str, frontend_origin: str) -> str:
    """Build the frontend URL users open to set a new password."""
    base = (frontend_origin or 'http://127.0.0.1:5500').rstrip('/')
    return f"{base}/pages/auth.html?token={quote(plain_token, safe='')}"


def _password_reset_bodies(reset_url: str) -> tuple[str, str]:
    text = (
        'You requested a password reset for your BiblioDrift account.\n\n'
        f'Open this link to choose a new password (valid for 1 hour):\n{reset_url}\n\n'
        'If you did not request this, you can ignore this email.'
    )
    html = (
        '<p>You requested a password reset for your <strong>BiblioDrift</strong> account.</p>'
        f'<p><a href="{reset_url}">Reset your password</a> (link expires in 1 hour).</p>'
        '<p>If you did not request this, you can ignore this email.</p>'
    )
    return text, html


def send_password_reset_email(
    to_email: str,
    reset_url: str,
    config: EmailConfig,
) -> EmailSendResult:
    """Send the password reset message. Does not raise on provider errors."""
    if not is_email_configured(config):
        return EmailSendResult(ok=False, detail='email_not_configured')

    text_body, html_body = _password_reset_bodies(reset_url)
    provider = (config.service_provider or 'sendgrid').strip().lower()

    try:
        if provider == 'sendgrid':
            return _send_via_sendgrid(
                to_email=to_email,
                subject=PASSWORD_RESET_SUBJECT,
                text_body=text_body,
                html_body=html_body,
                config=config,
            )
        if provider == 'smtp':
            return _send_via_smtp(
                to_email=to_email,
                subject=PASSWORD_RESET_SUBJECT,
                text_body=text_body,
                html_body=html_body,
                config=config,
            )
        return EmailSendResult(ok=False, detail=f'unsupported_provider:{provider}')
    except Exception as exc:
        logger.error('Password reset email failed for %s: %s', to_email, exc, exc_info=True)
        return EmailSendResult(ok=False, detail=str(exc))


def _send_via_sendgrid(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    config: EmailConfig,
) -> EmailSendResult:
    payload = {
        'personalizations': [{'to': [{'email': to_email}]}],
        'from': {'email': config.from_email},
        'subject': subject,
        'content': [
            {'type': 'text/plain', 'value': text_body},
            {'type': 'text/html', 'value': html_body},
        ],
    }
    response = requests.post(
        SENDGRID_API_URL,
        headers={
            'Authorization': f'Bearer {config.api_key}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=15,
    )
    if response.status_code in (200, 202):
        return EmailSendResult(ok=True)
    logger.error(
        'SendGrid rejected mail to %s: HTTP %s %s',
        to_email,
        response.status_code,
        response.text[:500],
    )
    return EmailSendResult(ok=False, detail=f'sendgrid_http_{response.status_code}')


def _send_via_smtp(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    config: EmailConfig,
) -> EmailSendResult:
    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = config.from_email
    message['To'] = to_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype='html')

    host = config.smtp_host
    port = config.smtp_port
    use_tls = config.smtp_use_tls

    if use_tls:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            if config.smtp_username and config.smtp_password:
                smtp.login(config.smtp_username, config.smtp_password)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            if config.smtp_username and config.smtp_password:
                smtp.login(config.smtp_username, config.smtp_password)
            smtp.send_message(message)

    return EmailSendResult(ok=True)
