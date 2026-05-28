/**
 * Password reset UI for auth.html — self-contained so it does not depend on app.js finishing load.
 */
(function () {
    const apiBase = typeof MOOD_API_BASE !== 'undefined'
        ? MOOD_API_BASE
        : 'http://127.0.0.1:5000/api/v1';

    function notify(message, type) {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            alert(message);
        }
    }

    function showForgotResetLink(resetUrl) {
        const box = document.getElementById('forgotResetLinkBox');
        if (!box || !resetUrl) return;
        box.style.display = 'block';
        const safeUrl = resetUrl.replace(/"/g, '&quot;');
        box.innerHTML =
            '<strong>Development reset link</strong> (no email was sent):<br>' +
            `<a href="${safeUrl}">Open link to set a new password</a>`;
    }

    function showForgotResetLinkMissing() {
        const box = document.getElementById('forgotResetLinkBox');
        if (!box) return;
        box.style.display = 'block';
        box.innerHTML =
            '<strong>No reset link was generated.</strong><br>' +
            'Common reasons: this email is not registered yet, or your local database is out of date ' +
            '(run <code>flask db upgrade</code> in the backend folder). ' +
            'Register first with this email, then try again. Check the Flask terminal for errors.';
    }

    async function handleForgotPassword(event) {
        if (event) event.preventDefault();

        const btn = document.getElementById('forgotSubmitBtn');
        const emailInput = document.getElementById('forgotEmail');
        const linkBox = document.getElementById('forgotResetLinkBox');
        const email = emailInput?.value?.trim() || '';
        const originalText = btn ? btn.textContent : 'Send reset link';

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            notify('Enter a valid email address', 'error');
            return;
        }

        if (linkBox) {
            linkBox.style.display = 'none';
            linkBox.innerHTML = '';
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Sending...';
        }

        try {
            const res = await fetch(`${apiBase}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            const message = data.message
                || 'If an account exists for that email, password reset instructions have been sent.';

            if (res.ok) {
                const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
                if (data.reset_url) {
                    showForgotResetLink(data.reset_url);
                    console.info('[Dev] Password reset link:', data.reset_url);
                    notify('Use the reset link shown below.', 'info');
                } else if (isLocalDev) {
                    showForgotResetLinkMissing();
                    notify(message, 'success');
                } else {
                    notify(message, 'success');
                }
            } else {
                notify(data.error || data.message || 'Unable to send reset link.', 'error');
            }
        } catch (error) {
            console.error('Forgot password failed:', error);
            notify(
                'Could not reach the server. Use http://127.0.0.1:5500/pages/auth.html (not file://) and ensure Flask is on port 5000.',
                'error'
            );
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    }

    async function handleResetPassword(event) {
        if (event) event.preventDefault();

        const btn = document.getElementById('resetSubmitBtn');
        const newPassword = document.getElementById('newPassword')?.value || '';
        const confirmPassword = document.getElementById('confirmPassword')?.value || '';
        const token = new URLSearchParams(window.location.search).get('token') || '';
        const originalText = btn ? btn.textContent : 'Reset password';

        if (newPassword.length < 8) {
            notify('Password must be at least 8 characters.', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            notify('Passwords do not match.', 'error');
            return;
        }
        if (!token) {
            notify('Invalid or missing reset link.', 'error');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Updating...';
        }

        try {
            const res = await fetch(`${apiBase}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token, password: newPassword }),
            });
            const data = await res.json();

            if (res.ok) {
                notify(data.message || 'Password updated. You can sign in now.', 'success');
                const url = new URL(window.location.href);
                url.searchParams.delete('token');
                setTimeout(() => {
                    window.location.href = url.pathname + url.search;
                }, 1200);
            } else {
                notify(data.error || data.message || 'Unable to reset password.', 'error');
            }
        } catch (error) {
            console.error('Reset password failed:', error);
            notify('Network error. Please try again.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    }

    function bindForms() {
        const forgotForm = document.getElementById('forgotPasswordForm');
        if (forgotForm) {
            forgotForm.addEventListener('submit', handleForgotPassword);
        }

        const resetForm = document.getElementById('resetPasswordForm');
        if (resetForm) {
            resetForm.addEventListener('submit', handleResetPassword);
        }
    }

    window.handleForgotPassword = handleForgotPassword;
    window.handleResetPassword = handleResetPassword;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindForms);
    } else {
        bindForms();
    }
})();
