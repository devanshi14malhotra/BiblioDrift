const assert = require('node:assert/strict');
const {
  isSafeHref,
  createSanitizeHTMLConfig,
  sanitizeHTML,
} = require('./security.js');

function createMockDOMPurify() {
  const hooks = [];

  return {
    hooks,
    addHook(name, fn) {
      if (name === 'uponSanitizeAttribute') {
        hooks.push(fn);
      }
    },
    sanitize(dirty, config) {
      return dirty
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<a\s+([^>]+)>(.*?)<\/a>/gis, (match, attrs, text) => {
          const attrMap = {};
          attrs.replace(/([a-zA-Z0-9_-]+)="([^"]*)"/g, (_, name, value) => {
            attrMap[name.toLowerCase()] = value;
            return '';
          });

          const data = {
            attrName: 'href',
            attrValue: attrMap.href || '',
            keepAttr: true,
          };

          hooks.forEach((hook) => hook({ nodeName: 'A' }, data));

          const href = data.keepAttr && config.ALLOWED_URI_REGEXP.test((attrMap.href || '').trim())
            ? ` href="${attrMap.href}"`
            : '';
          const title = attrMap.title ? ` title="${attrMap.title}"` : '';

          return `<a${href}${title}>${text}</a>`;
        })
        .replace(/<(?!\/?(a|b|i|em|strong|u|br|p)\b)[^>]+>/gis, '');
    },
  };
}

function withMockDOMPurify(mock, fn) {
  const previous = globalThis.DOMPurify;
  globalThis.DOMPurify = mock;
  try {
    fn();
  } finally {
    globalThis.DOMPurify = previous;
  }
}

assert.equal(isSafeHref('https://example.com/page'), true);
assert.equal(isSafeHref('mailto:reader@example.com'), true);
assert.equal(isSafeHref('/relative/path'), true);
assert.equal(isSafeHref('#chapter-1'), true);
assert.equal(isSafeHref('javascript:alert(1)'), false);
assert.equal(isSafeHref('data:text/html,<script>alert(1)</script>'), false);

const config = createSanitizeHTMLConfig();
assert.deepEqual(config.ALLOWED_TAGS, ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'a']);
assert.deepEqual(config.ALLOWED_ATTR, { a: ['href', 'title'] });
assert.ok(config.ALLOWED_URI_REGEXP.test('https://example.com'));
assert.ok(!config.ALLOWED_URI_REGEXP.test('javascript:alert(1)'));

withMockDOMPurify(createMockDOMPurify(), () => {
  const safe = sanitizeHTML('<p>Hello <a href="https://example.com">world</a></p>');
  const unsafe = sanitizeHTML('<p>Hello <a href="javascript:alert(1)">world</a></p><script>alert(1)</script>');

  assert.equal(safe, '<p>Hello <a href="https://example.com">world</a></p>');
  assert.equal(unsafe, '<p>Hello <a>world</a></p>');
});

withMockDOMPurify(undefined, () => {
  const escaped = sanitizeHTML('<img src=x onerror="alert(1)">');
  assert.equal(escaped, '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

console.log('frontend/js/security.js policy tests passed');
