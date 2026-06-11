# Landing Page — Structure & Architecture

## Overview
This document describes the landing page (`frontend/pages/landing.html`) structure, visual architecture, and the recent "cherry blossom" feature that was added. It explains where markup, styles, and scripts live, how the blossom system works, accessibility considerations, performance notes, and a concise changelog of edits made.

---

## File locations
- Main landing page HTML (single-file): `frontend/pages/landing.html`
- New documentation: `landing page/landing.md` (this file)

All blossom-related edits were made inline inside `landing.html` (styles in the `<style>` block, and script in the bottom inline `<script>` block).

---

## High-level HTML structure
The landing page is structured as a single HTML document (static), with these major sections:
- Header: `.landing-header` (brand, nav, actions)
- Main content: `.landing-main` containing
  - Hero: `.landing-hero` (headline, CTA)
  - About / Features / Community / Contributors panels
  - Footer: `.landing-footer`
- Floating blossom control: `button#blossomToggle.blossom-toggle` appended near the footer inside the main shell

The page uses many utility and region classes (e.g. `.landing-shell`, `.landing-hero`, `.landing-section`, `.reveal`). The blossom system adds a separate full-viewport layer DOM node for decorations.

---

## Blossom feature — architecture and APIs
Purpose: provide an optional decorative cherry-blossom rain/bloom effect that users can toggle on/off.

Key DOM elements and classes
- `button#blossomToggle.blossom-toggle` — floating control users click to enable/disable blossom mode.
- `div.blossom-layer` — top-level fixed container appended to `document.body` to hold petal nodes. `pointer-events: none` so it won't intercept input.
- Petal nodes: created as `span` elements with class `.blossom-petal` plus size variants `.blossom-petal--large` / `--small`.

CSS interfaces
- `.blossom-layer` is `position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 30;` so it covers the viewport without blocking interactions.
- `.blossom-petal` uses CSS keyframe animation `blossom-fall` (movement, opacity) and `blossom-glow` for subtle shine.
- Petal visual variations are controlled with CSS custom properties used by JS: `--petal-dx`, `--petal-dy`, `--petal-rotation`, `--petal-duration`, `--petal-delay`.

JavaScript functions & flows
- `createBlossomPetal(originX, originY, driftScale)` — creates a `span.blossom-petal`, initializes CSS custom properties and inline position, appends it to `.blossom-layer`. Each petal removes itself on `animationend`.
- `burstBlossoms(source)` — button-centered small burst (used for click feedback at the button). Computes source bounding rect and spawns several petals.
- `rainBlossoms()` — one-shot wave that spawns a number of petals above the viewport (used for continuous rain effect).
- `fullPageBloom(count)` — spawns `count` petals distributed over the current viewport (used for an initial fill when enabling blossom-mode).
- `startBlossomRain()` / `stopBlossomRain()` — start/stop the rain interval (regular waves).
- `startFullBloom()` / internal `blossomBloomTimer` — runs a continuous generator that creates a few petals at short intervals to produce a smooth, ongoing bloom (no large repeating bursts).

State & persistence
- Local storage key: `bibliodrift_blossom_mode` — stores `'1'` when blossom-mode is enabled. On page load the script reads this and will auto-start the effect only if the user previously enabled it and they do NOT have `prefers-reduced-motion`.
- CSS `prefers-reduced-motion` detection: `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is used to make the effect gentler (lower rate, fewer petals) or to keep auto-start disabled.

Accessibility & reduced motion
- The feature respects `prefers-reduced-motion`: when the user prefers reduced motion the script uses smaller counts and longer intervals; auto-start is suppressed by default.
- `blossom-layer` is marked with `aria-hidden="true"` so assistive tech ignores decorative petals.
- The toggle button updates `aria-pressed` to reflect state and includes a user-facing `title` note when reduced-motion is detected.

Performance considerations
- Petals are removed automatically on `animationend` to avoid DOM leaks.
- The bloom generator caps the number of petals spawned per tick and checks current live petals to prevent runaway DOM ballooning.
- Two concurrent timers are used: one for rain waves and one for the smooth bloom generator; intervals are adjusted under `prefers-reduced-motion`.
- Tuneable parameters are centralized in the script: petals per wave, spawn interval, petals per tick, and max live petals.

Testing and verification
- Manual test: open `frontend/pages/landing.html` in a browser and click the bottom floating blossom button. Expected behavior:
  1. A one-time, gentle full-page bloom fills the viewport once.
  2. A small visual burst at the button.
  3. Ongoing smooth stream of petals (small batches at short intervals) plus occasional rain waves.
  4. Clicking the button again stops both timers and removes existing petals.
- Reduced-motion test: enable OS-level reduced-motion preference and verify the effect is gentler and auto-start is disabled.

Changelog — edits made to implement blossom
- Added CSS definitions in the `<style>` block: `.blossom-layer`, `.blossom-petal`, size variants, `@keyframes blossom-fall` and `blossom-glow`, and media adjustments for `prefers-reduced-motion`.
- Added the DOM `button#blossomToggle` control near footer/main in `landing.html`.
- Appended an inline script at the end of `landing.html` that:
  - Creates `div.blossom-layer` and appends it to `document.body`.
  - Implements `createBlossomPetal`, `burstBlossoms`, `rainBlossoms`, `fullPageBloom`, `startBlossomRain`, `startFullBloom`, and `stopBlossomRain` functions.
  - Persists mode state using `localStorage` key `bibliodrift_blossom_mode`.
  - Respects `prefers-reduced-motion` for gentler defaults.

Reverting changes
- To revert the blossom feature, remove the following additions from `frontend/pages/landing.html`:
  - The CSS rules for `.blossom-layer`, `.blossom-petal` and keyframes.
  - The `button#blossomToggle` element.
  - The script block that creates and manages the blossom layer.

Next steps & extensions
- Add an intensity control (low/med/high) exposed near the toggle to let users pick density and rate. This would centralize petals-per-tick and spawn interval.
- Add a small unit test harness (headless browser) to ensure the script doesn't leak nodes.
- Consider extracting the blossom script and styles to small separate files (e.g., `static/js/blossom.js` and `static/css/blossom.css`) if you prefer to keep `landing.html` slim and cacheable.

---

If you'd like, I can:
- Add an intensity UI control (I can implement low/medium/high with presets), or
- Move the script/styles into standalone files and update `landing.html` to load them.

File created: `landing page/landing.md`
