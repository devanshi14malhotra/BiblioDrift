/**
 * authValidator.js  —  Issue #790
 * Wires up real-time password strength UI for the BiblioDrift auth page.
 * Depends on passwordValidator.js (imported first in auth.html).
 */

import { validatePassword, PASSWORD_RULES } from './passwordValidator.js';

// ─── Element references ───────────────────────────────────────────────────────
const passwordInput  = document.getElementById('password');
const strengthFill   = document.getElementById('strength-fill');
const strengthLabel  = document.getElementById('strength-label');
const submitBtn      = document.getElementById('submitBtn');
const authForm       = document.getElementById('authForm');

// Map rule id (from passwordValidator.js) → <li> id in auth.html
const RULE_TO_LI = {
    'len':  'chk-len',
    'up':   'chk-up',
    'low':  'chk-low',
    'num':  'chk-num',
    'spec': 'chk-spec',
};

const STRENGTH_COLORS = {
    weak:   '#E24B4A',
    fair:   '#EF9F27',
    good:   '#EF9F27',
    strong: '#1D9E75',
};

// ─── Show / hide checklist based on form mode ─────────────────────────────────
function isRegisterMode() {
    return authForm && authForm.dataset.mode === 'register';
}

function setChecklistVisible(visible) {
    const bar = document.querySelector('.password-strength-bar');
    const lbl = strengthLabel;
    const ul  = document.getElementById('pw-checklist');
    if (bar) bar.style.display = visible ? '' : 'none';
    if (lbl) lbl.style.display = visible ? '' : 'none';
    if (ul)  ul.style.display  = visible ? '' : 'none';
}

// ─── Core update function ─────────────────────────────────────────────────────
function updateStrengthUI() {
    const val = passwordInput ? passwordInput.value : '';

    // Only show strength UI when in register mode
    if (!isRegisterMode()) {
        setChecklistVisible(false);
        return;
    }

    setChecklistVisible(true);

    if (!val) {
        // Reset everything when field is empty
        if (strengthFill)  { strengthFill.style.width = '0%'; strengthFill.style.background = ''; }
        if (strengthLabel)   strengthLabel.textContent = '';
        Object.values(RULE_TO_LI).forEach(liId => {
            const li = document.getElementById(liId);
            if (li) { li.classList.remove('pass', 'fail'); }
        });
        if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.45'; submitBtn.style.cursor = 'not-allowed'; }
        return;
    }

    const { isValid, results, strength } = validatePassword(val);

    // Update strength bar
    const pct = (results.filter(r => r.passed).length / PASSWORD_RULES.length) * 100;
    if (strengthFill) {
        strengthFill.style.width      = `${pct}%`;
        strengthFill.style.background = STRENGTH_COLORS[strength] || '#E24B4A';
    }
    if (strengthLabel) {
        strengthLabel.textContent = strength
            ? strength.charAt(0).toUpperCase() + strength.slice(1)
            : '';
        strengthLabel.style.color = STRENGTH_COLORS[strength] || '#888';
    }

    // Update checklist items
    results.forEach(({ id, passed }) => {
        const liId = RULE_TO_LI[id];
        if (!liId) return;
        const li = document.getElementById(liId);
        if (!li) return;
        li.classList.toggle('pass', passed);
        li.classList.toggle('fail', !passed);
    });

    // Enable / disable submit button
    if (submitBtn) {
        submitBtn.disabled      = !isValid;
        submitBtn.style.opacity = isValid ? '1' : '0.45';
        submitBtn.style.cursor  = isValid ? 'pointer' : 'not-allowed';
    }
}

// ─── Listen to password input ─────────────────────────────────────────────────
if (passwordInput) {
    passwordInput.addEventListener('input', updateStrengthUI);
}

// ─── Reset UI when toggling between login ↔ register ────────────────────────
// auth.html's inline script toggles authForm.dataset.mode — we observe that.
if (authForm) {
    const observer = new MutationObserver(() => {
        updateStrengthUI();
        // In login mode, always re-enable submit (no strength requirement)
        if (!isRegisterMode() && submitBtn) {
            submitBtn.disabled      = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor  = 'pointer';
        }
    });
    observer.observe(authForm, { attributes: true, attributeFilter: ['data-mode'] });
}

// ─── Block form submission if password is weak (register mode) ───────────────
if (authForm) {
    authForm.addEventListener('submit', (e) => {
        if (!isRegisterMode()) return;   // login — no strength check needed

        const val = passwordInput ? passwordInput.value : '';
        const { isValid, errors } = validatePassword(val);

        if (!isValid) {
            e.preventDefault();
            e.stopImmediatePropagation();

            // Shake the checklist to draw attention
            const ul = document.getElementById('pw-checklist');
            if (ul) {
                ul.style.animation = 'none';
                ul.offsetHeight;   // reflow
                ul.style.animation = 'shake 0.4s ease';
            }

            // Force-update UI so user sees which rules failed
            updateStrengthUI();
        }
    }, true);   // capture phase — runs before handleAuth()
}

// ─── Simple shake keyframe (injected once) ───────────────────────────────────
const style = document.createElement('style');
style.textContent = `
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-6px); }
  40%      { transform: translateX(6px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(4px); }
}`;
document.head.appendChild(style);

// ─── Init: hide checklist on page load (starts in login mode) ────────────────
setChecklistVisible(false);