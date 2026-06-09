import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.email_service import EmailSendResult


@patch('backend.app.send_password_reset_email')
@patch('backend.app.is_email_configured', return_value=True)
def test_forgot_password_sends_email_when_configured(
    _mock_configured,
    mock_send,
    client,
    test_user,
):
    mock_send.return_value = EmailSendResult(ok=True)

    res = client.post(
        '/api/v1/auth/forgot-password',
        json={'email': test_user.email},
    )

    assert res.status_code == 200
    body = res.get_json()
    assert body.get('reset_url') is None
    mock_send.assert_called_once()
    assert mock_send.call_args[0][0] == test_user.email


@patch('backend.app.send_password_reset_email')
@patch('backend.app.is_email_configured', return_value=False)
def test_forgot_password_dev_reset_url_when_email_disabled(
    _mock_configured,
    mock_send,
    client,
    test_user,
    monkeypatch,
):
    monkeypatch.setenv('APP_ENV', 'development')
    res = client.post(
        '/api/v1/auth/forgot-password',
        json={'email': test_user.email},
    )

    assert res.status_code == 200
    body = res.get_json()
    assert 'reset_url' in body
    assert 'token=' in body['reset_url']
    mock_send.assert_not_called()
