import os
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.config import EmailConfig
from backend.email_service import (
    build_password_reset_url,
    is_email_configured,
    send_password_reset_email,
)


def test_build_password_reset_url_encodes_token():
    url = build_password_reset_url('abc+def/token', 'http://127.0.0.1:5500/')
    assert url.startswith('http://127.0.0.1:5500/pages/auth.html?token=')
    assert 'abc%2Bdef%2Ftoken' in url


def test_is_email_configured_sendgrid():
    cfg = EmailConfig(
        api_key='sg-key',
        from_email='noreply@example.com',
        service_provider='sendgrid',
    )
    assert is_email_configured(cfg) is True


def test_is_email_configured_sendgrid_missing_key():
    cfg = EmailConfig(
        api_key=None,
        from_email='noreply@example.com',
        service_provider='sendgrid',
    )
    assert is_email_configured(cfg) is False


def test_is_email_configured_smtp():
    cfg = EmailConfig(
        api_key=None,
        from_email='noreply@example.com',
        service_provider='smtp',
        smtp_host='smtp.example.com',
    )
    assert is_email_configured(cfg) is True


@patch('backend.email_service.requests.post')
def test_send_password_reset_email_sendgrid_success(mock_post):
    mock_post.return_value = MagicMock(status_code=202, text='')
    cfg = EmailConfig(
        api_key='sg-test',
        from_email='noreply@bibliodrift.com',
        service_provider='sendgrid',
    )
    result = send_password_reset_email(
        'user@example.com',
        'http://127.0.0.1:5500/pages/auth.html?token=abc',
        cfg,
    )
    assert result.ok is True
    mock_post.assert_called_once()
    assert mock_post.call_args.kwargs['json']['personalizations'][0]['to'][0]['email'] == 'user@example.com'


@patch('backend.email_service.requests.post')
def test_send_password_reset_email_sendgrid_failure(mock_post):
    mock_post.return_value = MagicMock(status_code=403, text='Forbidden')
    cfg = EmailConfig(
        api_key='sg-test',
        from_email='noreply@bibliodrift.com',
        service_provider='sendgrid',
    )
    result = send_password_reset_email(
        'user@example.com',
        'http://127.0.0.1:5500/pages/auth.html?token=abc',
        cfg,
    )
    assert result.ok is False


@patch('backend.email_service.smtplib.SMTP')
def test_send_password_reset_email_smtp_success(mock_smtp_cls):
    mock_smtp = MagicMock()
    mock_smtp_cls.return_value.__enter__.return_value = mock_smtp
    cfg = EmailConfig(
        api_key=None,
        from_email='noreply@bibliodrift.com',
        service_provider='smtp',
        smtp_host='localhost',
        smtp_port=1025,
        smtp_use_tls=False,
    )
    result = send_password_reset_email(
        'user@example.com',
        'http://127.0.0.1:5500/pages/auth.html?token=abc',
        cfg,
    )
    assert result.ok is True
    mock_smtp.send_message.assert_called_once()
