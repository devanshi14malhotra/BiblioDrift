/**
 * Frontend Security Utilities for BiblioDrift
 * Provides XSS prevention, input validation, and secure content rendering
 */

/**
 * Initialize DOMPurify configuration
 * Configures DOMPurify with strict defaults to prevent XSS
 */
function isDOMPurifyAvailable() {
    return typeof globalThis !== 'undefined'
        && typeof globalThis.DOMPurify !== 'undefined'
        && globalThis.DOMPurify
        && typeof globalThis.DOMPurify.sanitize === 'function'
        && typeof globalThis.DOMPurify.addHook === 'function';
}

const SAFE_HREF_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const SAFE_HREF_PATTERN = /^(?:(?:https?:|mailto:)[^\s]*|#.*|\/(?!\/)[^\s]*|[^:/\s][^:\s]*)$/i;
let domPurifyHooksRegistered = false;

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD VALIDATION  (Issue #790)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rules that every new password must satisfy.
 * Each rule has a unique id (used to target the checklist <li>),
 * a regex to test against, and the human-readable message shown to the user.
 */
const PASSWORD_RULES = [
    { id: 'pw-len',  regex: /.{8,}/,      msg: 'At least 8 characters' },
    { id: 'pw-up',   regex: /[A-Z]/,      msg: 'One uppercase letter (A–Z)' },
    { id: 'pw-low',  regex: /[a-z]/,      msg: 'One lowercase letter (a–z)' },
    { id: 'pw-num',  regex: /[0-9]/,      msg: 'One digit (0–9)' },
    { id: 'pw-spec', regex: /[@#$!%&*]/,  msg: 'One special character (@, #, $, !, %, &, *)' },
];

/**
 * Validate password strength against PASSWORD_RULES.
 *
 * @param {string} password - The password to test
 * @returns {{ isValid: boolean, errors: string[], strength: string, results: Array }}
 *   - isValid   : true only when ALL rules pass
 *   - errors    : array of failure messages (empty when valid)
 *   - strength  : 'weak' | 'fair' | 'good' | 'strong'
 *   - results   : per-rule objects { id, msg, passed } for building UI checklists
 */
function validatePassword(password) {
    if (typeof password !== 'string') {
        return { isValid: false, errors: ['Password must be a string'], strength: 'weak', results: [] };
    }

    const results = PASSWORD_RULES.map(rule => ({
        id:     rule.id,
        msg:    rule.msg,
        passed: rule.regex.test(password),
    }));

    const passedCount = results.filter(r => r.passed).length;
    const errors      = results.filter(r => !r.passed).map(r => r.msg);

    // Map 1–5 passed rules to a label; 0 rules = no label yet
    const strengthMap = { 1: 'weak', 2: 'weak', 3: 'fair', 4: 'good', 5: 'strong' };
    const strength    = passedCount === 0 ? '' : (strengthMap[passedCount] || 'weak');

    return {
        isValid: passedCount === PASSWORD_RULES.length,
        errors,
        strength,
        results,
    };
}

/**
 * Wire up real-time password strength UI.
 *
 * Expects this HTML structure inside your registration form:
 *
 *   <input type="password" id="password" />
 *
 *   <div class="password-strength-bar">
 *     <div id="strength-fill" class="strength-fill"></div>
 *   </div>
 *   <p id="strength-label" class="strength-label"></p>
 *
 *   <ul class="pw-checklist">
 *     <li id="pw-len">  At least 8 characters</li>
 *     <li id="pw-up">   One uppercase letter (A–Z)</li>
 *     <li id="pw-low">  One lowercase letter (a–z)</li>
 *     <li id="pw-num">  One digit (0–9)</li>
 *     <li id="pw-spec"> One special character (@, #, $, !, %, &, *)</li>
 *   </ul>
 *
 * @param {string} inputId    - id of the <input type="password"> element
 * @param {string} fillId     - id of the strength bar fill <div>
 * @param {string} labelId    - id of the strength label <p>
 * @param {string} submitId   - id of the submit/register <button> to enable/disable
 */
function initPasswordStrengthUI(inputId, fillId, labelId, submitId) {
    const inputEl  = document.getElementById(inputId);
    const fillEl   = document.getElementById(fillId);
    const labelEl  = document.getElementById(labelId);
    const submitEl = submitId ? document.getElementById(submitId) : null;

    if (!inputEl || !fillEl || !labelEl) {
        console.warn('initPasswordStrengthUI: one or more required elements not found.');
        return;
    }

    const STRENGTH_COLORS = {
        weak:   '#E24B4A',
        fair:   '#EF9F27',
        good:   '#EF9F27',
        strong: '#1D9E75',
    };

    inputEl.addEventListener('input', () => {
        const { isValid, results, strength } = validatePassword(inputEl.value);

        // Update bar width + color
        const pct = (results.filter(r => r.passed).length / PASSWORD_RULES.length) * 100;
        fillEl.style.width      = inputEl.value.length === 0 ? '0%' : `${pct}%`;
        fillEl.style.background = STRENGTH_COLORS[strength] || '#E24B4A';

        // Update label text
        labelEl.textContent = inputEl.value.length === 0 ? '' : strength;

        // Update checklist items
        results.forEach(({ id, passed }) => {
            const li = document.getElementById(id);
            if (!li) return;
            li.classList.toggle('pass', passed);
            li.classList.toggle('fail', !passed && inputEl.value.length > 0);
        });

        // Enable / disable submit button
        if (submitEl) {
            submitEl.disabled        = !isValid;
            submitEl.style.opacity   = isValid ? '1' : '0.45';
            submitEl.style.cursor    = isValid ? 'pointer' : 'not-allowed';
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// END PASSWORD VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function getDOMPurify() {
    return isDOMPurifyAvailable() ? globalThis.DOMPurify : null;
}

function isSafeHref(href) {
    if (typeof href !== 'string') return false;

    const trimmed = href.trim();
    if (!trimmed) return false;

    if (!SAFE_HREF_PATTERN.test(trimmed)) return false;

    try {
        const base = typeof document !== 'undefined' && document.baseURI ? document.baseURI : 'https://example.invalid/';
        const parsed = new URL(trimmed, base);
        if (SAFE_HREF_PROTOCOLS.includes(parsed.protocol)) {
            return true;
        }
    } catch (e) {
        // Relative paths and fragment links may fail URL parsing in some environments.
        return trimmed.startsWith('#') || trimmed.startsWith('/');
    }

    return trimmed.startsWith('#') || trimmed.startsWith('/');
}

function createSanitizeHTMLConfig() {
    return {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'a'],
        ALLOWED_ATTR: {
            'a': ['href', 'title']
        },
        ALLOWED_URI_REGEXP: SAFE_HREF_PATTERN,
        KEEP_CONTENT: true,
        RETURN_DOM: false,
    };
}

function registerDOMPurifyHooks() {
    const purify = getDOMPurify();
    if (!purify || domPurifyHooksRegistered) return;

    purify.addHook('uponSanitizeAttribute', (node, data) => {
        if (!node || !data || node.nodeName !== 'A' || data.attrName !== 'href') return;
        if (!isSafeHref(data.attrValue)) {
            data.keepAttr = false;
        }
    });

    domPurifyHooksRegistered = true;
}

function initializeDOMPurify() {
    if (!isDOMPurifyAvailable()) {
        console.error('DOMPurify library not loaded. XSS protection may be compromised.');
        return null;
    }

    // Configure DOMPurify with strict settings
    const config = {
        ALLOWED_TAGS: [],  // No HTML tags allowed by default
        ALLOWED_ATTR: [],  // No attributes allowed
        KEEP_CONTENT: true,  // Keep text content when removing tags
        RETURN_DOM: false,  // Return HTML string, not DOM
        RETURN_DOM_FRAGMENT: false,
        RETURN_DOM_IMPORT: false,
        FORCE_BODY: false,
        SANITIZE_DOM: true,  // Sanitize the DOM according to configuration
        IN_PLACE: false,  // Don't modify input
    };

    return config;
}

/**
 * Sanitize user-generated content for display
 * Removes all HTML and potentially dangerous content
 * 
 * @param {string} dirty - Unsanitized content
 * @param {object} customConfig - Optional custom DOMPurify config
 * @returns {string} Sanitized content safe to display
 */
function sanitizeForDisplay(dirty, customConfig = null) {
    if (!dirty) return '';
    if (typeof dirty !== 'string') return String(dirty);

    const config = customConfig || initializeDOMPurify();
    if (!config) return HTML.escape(dirty);

    return getDOMPurify().sanitize(dirty, config);
}

/**
 * Sanitize HTML content while preserving safe markup
 * Used for content that should have limited HTML (e.g., bold, italic)
 * 
 * @param {string} dirty - Potentially unsafe HTML
 * @returns {string} Sanitized HTML with limited markup
 */
function sanitizeHTML(dirty) {
    if (!dirty) return '';
    if (typeof dirty !== 'string') return String(dirty);

    const purify = getDOMPurify();
    if (!purify) {
        console.error('DOMPurify library not loaded. Falling back to escaped text for safe rendering.');
        return HTML.escape(dirty);
    }

    registerDOMPurifyHooks();
    return purify.sanitize(dirty, createSanitizeHTMLConfig());
}

/**
 * Safely insert content into DOM element
 * Prevents XSS by using textContent for text and sanitizing HTML
 * 
 * @param {HTMLElement} element - Target element
 * @param {string} content - Content to insert
 * @param {boolean} asHTML - Whether to treat content as HTML (default: false)
 */
function setElementContent(element, content, asHTML = false) {
    if (!element) {
        console.error('Element is null or undefined');
        return;
    }

    if (asHTML) {
        // Sanitize before inserting as HTML
        element.innerHTML = sanitizeHTML(content);
    } else {
        // Use textContent for plain text (always safe)
        element.textContent = content;
    }
}

/**
 * Validate and sanitize user input before sending to server.
 * Pass { isPassword: true } in options to also run password-strength checks.
 * 
 * @param {string} input - User input
 * @param {object} options - Validation options
 * @returns {object} {isValid, sanitized, errors}
 */
function validateUserInput(input, options = {}) {
    const {
        maxLength = 5000,
        minLength = 0,
        required = true,
        pattern = null,
        allowHTML = false,
        isPassword = false,   // ← NEW: set true for password fields
    } = options;

    const errors = [];

    // Type check
    if (typeof input !== 'string') {
        return {
            isValid: false,
            sanitized: '',
            errors: ['Input must be a string']
        };
    }

    // Length validation
    if (input.length === 0 && required) {
        errors.push('Input is required');
    }

    if (input.length < minLength) {
        errors.push(`Input must be at least ${minLength} characters`);
    }

    if (input.length > maxLength) {
        errors.push(`Input must be less than ${maxLength} characters`);
        return {
            isValid: false,
            sanitized: input.substring(0, maxLength),
            errors
        };
    }

    // Pattern validation
    if (pattern && !pattern.test(input)) {
        errors.push('Input does not match required format');
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
        /<script/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe/gi,
        /<embed/gi,
        /<object/gi,
        /data:text\/html/gi
    ];

    const hasDangerousContent = dangerousPatterns.some(p => p.test(input));
    
    if (hasDangerousContent && !allowHTML) {
        errors.push('Input contains potentially dangerous content');
    }

    // ── Password-strength check (Issue #790) ──────────────────────────────────
    if (isPassword && input.length > 0) {
        const pwValidation = validatePassword(input);
        if (!pwValidation.isValid) {
            errors.push(...pwValidation.errors);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // For password fields we skip HTML sanitization — passwords are never
    // rendered as HTML; sanitizing them would corrupt special characters.
    const sanitized = isPassword
        ? input
        : (allowHTML ? sanitizeHTML(input) : sanitizeForDisplay(input));

    return {
        isValid: errors.length === 0,
        sanitized,
        errors
    };
}

/**
 * Safe JSON parsing with error handling
 * 
 * @param {string} jsonString - JSON string to parse
 * @returns {object} {success, data, error}
 */
function safeJSONParse(jsonString) {
    try {
        if (typeof jsonString !== 'string') {
            return {
                success: false,
                data: null,
                error: 'Input must be a string'
            };
        }

        const data = JSON.parse(jsonString);
        return {
            success: true,
            data,
            error: null
        };
    } catch (e) {
        return {
            success: false,
            data: null,
            error: `Invalid JSON: ${e.message}`
        };
    }
}

/**
 * Create secure XMLHttpRequest headers
 * Includes anti-CSRF headers
 * 
 * @returns {object} Headers object
 */
function getSecureRequestHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        // Add CSRF token if available
        'X-CSRF-Token': getCSRFToken()
    };
}

/**
 * Get CSRF token from meta tag or cookie
 * 
 * @returns {string} CSRF token or empty string
 */
function getCSRFToken() {
    // Try meta tag first
    const metaToken = document.querySelector('meta[name="csrf-token"]');
    if (metaToken) {
        return metaToken.getAttribute('content');
    }

    // Try cookie
    const name = 'CSRF_TOKEN';
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    for (let i = 0; i < cookieArray.length; i++) {
        let cookie = cookieArray[i].trim();
        // Properly check if this cookie starts with the name and has = separator
        if (cookie.startsWith(name + '=')) {
            // Extract value after "CSRF_TOKEN="
            return cookie.substring(name.length + 1);
        }
    }

    return '';
}

/**
 * Make secure API request with validation
 * 
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise} Fetch promise
 */
async function secureAPIRequest(url, options = {}) {
    const {
        method = 'GET',
        body = null,
        headers = {}
    } = options;

    // Validate URL
    try {
        new URL(url, window.location.origin);
    } catch (e) {
        return Promise.reject(new Error('Invalid URL'));
    }

    // Combine headers
    const allHeaders = {
        ...getSecureRequestHeaders(),
        ...headers
    };

    // Prepare request
    const fetchOptions = {
        method,
        headers: allHeaders
    };

    // Sanitize body if present
    if (body) {
        if (typeof body === 'string') {
            fetchOptions.body = body;
        } else if (typeof body === 'object') {
            fetchOptions.body = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`API request failed: ${error.message}`);
        throw error;
    }
}

/**
 * Escape HTML special characters
 * Used as fallback when DOMPurify is not available
 * 
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
const HTML = {
    escape: function(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    unescape: function(text) {
        const map = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#039;': "'"
        };
        return text.replace(/&(?:amp|lt|gt|quot|#039);/g, m => map[m]);
    }
};

/**
 * Event listener for sanitizing contenteditable elements
 * Prevents XSS through content editable divs
 * 
 * @param {HTMLElement} element - Contenteditable element
 */
function makeContentEditableSafe(element) {
    if (!element || element.contentEditable !== 'true') return;

    element.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const validated = validateUserInput(text);
        if (validated.isValid) {
            document.execCommand('insertText', false, validated.sanitized);
        }
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        const text = e.dataTransfer.getData('text/plain');
        const validated = validateUserInput(text);
        if (validated.isValid) {
            document.execCommand('insertText', false, validated.sanitized);
        }
    });
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isDOMPurifyAvailable,
        getDOMPurify,
        isSafeHref,
        createSanitizeHTMLConfig,
        registerDOMPurifyHooks,
        initializeDOMPurify,
        sanitizeForDisplay,
        sanitizeHTML,
        setElementContent,
        validateUserInput,
        safeJSONParse,
        getSecureRequestHeaders,
        getCSRFToken,
        secureAPIRequest,
        HTML,
        makeContentEditableSafe,
        // ── Issue #790 exports ──────────────────────────────────────────────
        PASSWORD_RULES,
        validatePassword,
        initPasswordStrengthUI,
    };
}