/**
 * Frontend Security Utilities for BiblioDrift
 * Provides XSS prevention, input validation, and secure content rendering
 */

/**
 * Initialize DOMPurify configuration
 * Configures DOMPurify with strict defaults to prevent XSS
 */
function isDOMPurifyAvailable() {
    return typeof DOMPurify !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function';
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

    return DOMPurify.sanitize(dirty, config);
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

    const config = {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'a'],
        ALLOWED_ATTR: {
            'a': ['href', 'title']
        },
        KEEP_CONTENT: true,
        RETURN_DOM: false,
    };

    if (!isDOMPurifyAvailable()) {
        console.error('DOMPurify library not loaded. Falling back to escaped text for safe rendering.');
        return HTML.escape(dirty);
    }

    return DOMPurify.sanitize(dirty, config);
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
 * Validate and sanitize user input before sending to server
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
        allowHTML = false
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

    // Sanitize
    const sanitized = allowHTML ? sanitizeHTML(input) : sanitizeForDisplay(input);

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
        makeContentEditableSafe
    };
}
