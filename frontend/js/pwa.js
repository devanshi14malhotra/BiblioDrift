/**
 * ==============================================================================
 * BiblioDrift PWA — Service Worker Registration & Install Prompt
 * ==============================================================================
 *
 * Responsibilities:
 *   1. Register sw.js from the /frontend/ scope root.
 *   2. Show a custom "Install App" banner when the browser fires
 *      beforeinstallprompt, styled to match BiblioDrift's aesthetic.
 *   3. Listen for SW messages (e.g. SYNC_LIBRARY from background sync).
 *   4. Show an "App updated — reload" toast when a new SW activates.
 *
 * This file is intentionally standalone — it does not import or modify
 * any other module. It is loaded as the last script on every page.
 * ==============================================================================
 */

(function () {
    'use strict';

    // ── Service Worker Registration ────────────────────────────────────────────

    if (!('serviceWorker' in navigator)) return; // Browser doesn't support SW

    // The SW must be registered from a path at or above the pages it controls.
    // All pages live in /frontend/pages/, so registering from /frontend/sw.js
    // with scope /frontend/ covers all of them.
    const SW_URL   = '/frontend/sw.js';
    const SW_SCOPE = '/frontend/';

    if (window.location.protocol !== 'https:' && window.location.protocol !== 'http:') {
        console.warn('[PWA] Skipping service worker registration on unsupported protocol:', window.location.protocol);
        return;
    }

    let _swRegistration = null;
    let _syncRequestInFlight = false;

    navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
        .then((registration) => {
            _swRegistration = registration;

            // Detect when a new SW has installed and is waiting to activate
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', () => {
                    // A new SW is waiting — prompt the user to reload
                    if (
                        newWorker.state === 'installed' &&
                        navigator.serviceWorker.controller
                    ) {
                        _showUpdateToast(newWorker);
                    }
                });
            });
        })
        .catch((err) => {
            // SW registration failure is non-fatal — app still works online
            console.warn('[PWA] Service worker registration failed:', err);
        });

    async function _requestLibrarySync() {
        if (_syncRequestInFlight) return;
        _syncRequestInFlight = true;

        try {
            if (_swRegistration && 'sync' in _swRegistration) {
                await _swRegistration.sync.register('bibliodrift-library-sync');
            }

            if (navigator.onLine && window.libManager && typeof window.libManager.flushPendingLibraryMutations === 'function') {
                await window.libManager.flushPendingLibraryMutations();
            }
        } catch (err) {
            console.warn('[PWA] Failed to request library sync:', err);
        } finally {
            _syncRequestInFlight = false;
        }
    }

    window.requestLibrarySync = _requestLibrarySync;

    // Reload the page once the new SW has taken control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });

    // Listen for messages from the SW (e.g. background sync trigger)
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_LIBRARY') {
            if (window.libManager && typeof window.libManager.flushPendingLibraryMutations === 'function') {
                window.libManager.flushPendingLibraryMutations().catch((err) => {
                    console.warn('[PWA] Background library sync failed:', err);
                });
            }
        }
    });

    window.addEventListener('bibliodrift:library-sync-queued', _requestLibrarySync);
    window.addEventListener('online', _requestLibrarySync);

    // ── Install Prompt (A2HS) ──────────────────────────────────────────────────

    let _deferredPrompt = null; // holds the beforeinstallprompt event

    window.addEventListener('beforeinstallprompt', (event) => {
        // Prevent the mini-infobar from appearing on mobile
        event.preventDefault();
        _deferredPrompt = event;

        // Only show the banner if the user hasn't dismissed it this session
        if (!sessionStorage.getItem('pwa-install-dismissed')) {
            _showInstallBanner();
        }
    });

    // Clean up once the app is installed
    window.addEventListener('appinstalled', () => {
        _deferredPrompt = null;
        _hideInstallBanner();
        console.log('[PWA] BiblioDrift installed successfully.');
    });

    // ── Install Banner UI ──────────────────────────────────────────────────────

    
    function _showInstallBanner() {
        let banner = document.getElementById('pwa-install-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'pwa-install-banner';
            banner.setAttribute('role', 'banner');
            banner.setAttribute('aria-label', 'Install BiblioDrift app');
            banner.innerHTML = `
                <div class="pwa-banner-content">
                    <img src="../assets/images/biblioDrift_favicon.png"
                         alt="BiblioDrift icon" class="pwa-banner-icon">
                    <div class="pwa-banner-text">
                        <strong>Install BiblioDrift.</strong>
                        <span>Read offline, anytime.</span>
                    </div>
                </div>
                <div class="pwa-banner-actions">
                    <button class="pwa-install-btn" id="pwa-install-btn"
                        aria-label="Install BiblioDrift as an app">
                        Install
                    </button>
                    <button class="pwa-dismiss-btn" id="pwa-dismiss-btn"
                        aria-label="Dismiss install prompt">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;

            const footer = document.querySelector(".main-footer");
            if (footer) {
                footer.parentNode.insertBefore(banner, footer);
            } else {
                const main = document.querySelector("main");
                if (main) main.appendChild(banner);
                else document.body.appendChild(banner);
            }
            
            // Now attach listeners since we just created it
            _attachBannerListeners();
        }

        // Animate in
        requestAnimationFrame(() => banner.classList.add('pwa-banner-visible'));
    }

    function _attachBannerListeners() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn && !installBtn.dataset.listenerAttached) {
            installBtn.dataset.listenerAttached = 'true';
            installBtn.addEventListener('click', async () => {
                if (!_deferredPrompt) {
                    if (typeof showToast === 'function') {
                        showToast("Install prompt not available. You might already have the app installed, or your browser doesn't support it.", "info");
                    } else {
                        alert("Install prompt not available. You might already have the app installed, or your browser doesn't support it.");
                    }
                    return;
                }
                _deferredPrompt.prompt();
                const { outcome } = await _deferredPrompt.userChoice;
                _deferredPrompt = null;
                _hideInstallBanner();
                console.log(`[PWA] Install prompt outcome: ${outcome}`);
            });
        }

        const dismissBtn = document.getElementById('pwa-dismiss-btn');
        if (dismissBtn && !dismissBtn.dataset.listenerAttached) {
            dismissBtn.dataset.listenerAttached = 'true';
            dismissBtn.addEventListener('click', () => {
                sessionStorage.setItem('pwa-install-dismissed', '1');
                _hideInstallBanner();
            });
        }
    }
    
    // Attach listeners on load for any hardcoded buttons
    document.addEventListener("DOMContentLoaded", _attachBannerListeners);
    // Also run immediately in case DOM is already loaded
    _attachBannerListeners();

    function _hideInstallBanner() {
        const banner = document.getElementById('pwa-install-banner');
        if (!banner) return;
        banner.classList.remove('pwa-banner-visible');
        banner.addEventListener('transitionend', () => banner.remove(), { once: true });
    }

    // ── Update Toast ───────────────────────────────────────────────────────────

    function _showUpdateToast(newWorker) {
        // Reuse the app's existing showToast if available
        if (typeof showToast === 'function') {
            showToast('BiblioDrift updated — reload to get the latest version.', 'info');
            return;
        }

        // Fallback: create a minimal toast
        const toast = document.createElement('div');
        toast.id = 'pwa-update-toast';
        toast.setAttribute('role', 'status');
        toast.innerHTML = `
            <span>BiblioDrift updated.</span>
            <button id="pwa-reload-btn">Reload</button>
        `;
        toast.style.cssText = `
            position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
            background:#2c2420; color:#f9f7f2; padding:0.75rem 1.25rem;
            border-radius:8px; display:flex; align-items:center; gap:1rem;
            font-family:Georgia,serif; font-size:0.9rem; z-index:99999;
            box-shadow:0 4px 16px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(toast);

        document.getElementById('pwa-reload-btn').addEventListener('click', () => {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
        });

        setTimeout(() => toast.remove(), 8000);
    }

    // ── Online / Offline indicator ─────────────────────────────────────────────

    function _showOfflineIndicator() {
        let el = document.getElementById('pwa-offline-indicator');
        if (!el) {
            el = document.createElement('div');
            el.id = 'pwa-offline-indicator';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            el.innerHTML = '<i class="fa-solid fa-wifi-slash" aria-hidden="true"></i> You\'re offline — library still available';
            document.body.appendChild(el);
        }
        requestAnimationFrame(() => el.classList.add('visible'));
    }

    function _hideOfflineIndicator() {
        const el = document.getElementById('pwa-offline-indicator');
        if (!el) return;
        el.classList.remove('visible');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
    }

    window.addEventListener('offline', _showOfflineIndicator);
    window.addEventListener('online',  _hideOfflineIndicator);

    // Show immediately if already offline when the page loads
    if (!navigator.onLine) _showOfflineIndicator();

})();
