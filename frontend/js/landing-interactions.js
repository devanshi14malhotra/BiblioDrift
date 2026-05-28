/**
 * Landing Page Interactions
 * Handles reveal animations, blossom effects, navigation, and counters
 */

(function () {
    const yearEl = document.getElementById('currentYear');
    const landingLinks = document.querySelectorAll('.app-link');
    const revealTargets = document.querySelectorAll('.reveal');
    const blossomToggle = document.getElementById('blossomToggle');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const blossomKey = 'bibliodrift_blossom_mode';
    const blossomLayer = document.createElement('div');
    let blossomRainTimer = null;
    let blossomBloomTimer = null;

    blossomLayer.className = 'blossom-layer';
    blossomLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(blossomLayer);

    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    const syncButton = (enabled) => {
        if (!blossomToggle) return;
        blossomToggle.setAttribute('aria-pressed', String(enabled));
        blossomToggle.querySelector('.blossom-toggle-label').textContent = enabled ? 'Blooming' : 'Bloom';
    };

    const setBlossomMode = (enabled) => {
        document.body.classList.toggle('blossom-mode', enabled);
        syncButton(enabled);
        localStorage.setItem(blossomKey, enabled ? '1' : '0');
    };

    const createBlossomPetal = (originX, originY, driftScale = 1) => {
        const petal = document.createElement('span');
        const spreadX = (Math.random() * 220 - 110) * driftScale;
        const spreadY = -(120 + Math.random() * 260);
        const rotation = (Math.random() * 420) + 120;
        const size = 0.5 + Math.random() * 0.55;
        const variantRoll = Math.random();

        petal.className = `blossom-petal ${variantRoll > 0.72 ? 'blossom-petal--large' : variantRoll < 0.28 ? 'blossom-petal--small' : ''}`.trim();
        petal.style.left = `${originX + (Math.random() * 26 - 13)}px`;
        petal.style.top = `${originY + (Math.random() * 18 - 9)}px`;
        petal.style.setProperty('--petal-dx', `${spreadX}px`);
        petal.style.setProperty('--petal-dy', `${spreadY}px`);
        petal.style.setProperty('--petal-rotation', `${rotation}deg`);
        petal.style.setProperty('--petal-duration', `${1700 + Math.random() * 1600}ms`);
        petal.style.setProperty('--petal-delay', `${Math.random() * 220}ms`);
        petal.style.transform = `scale(${size})`;

        blossomLayer.appendChild(petal);
        petal.addEventListener('animationend', () => petal.remove(), { once: true });
    };

    const burstBlossoms = (source) => {
        if (!source || !blossomLayer) return;
        const rect = source.getBoundingClientRect();
        const originX = rect.left + rect.width * 0.5;
        const originY = rect.top + rect.height * 0.5;
        const petals = prefersReducedMotion ? 10 : 28;

        for (let index = 0; index < petals; index += 1) {
            createBlossomPetal(originX, originY, 1.2);
        }
    };

    const rainBlossoms = () => {
        if (!blossomLayer) return;
        const width = window.innerWidth || document.documentElement.clientWidth || 1280;
        const height = window.innerHeight || document.documentElement.clientHeight || 720;
        const petalsPerWave = prefersReducedMotion ? 8 : 22;

        for (let index = 0; index < petalsPerWave; index += 1) {
            const originX = Math.random() * width;
            const originY = -40 - (Math.random() * height * 0.25);
            const driftScale = 0.85 + Math.random() * 0.7;
            createBlossomPetal(originX, originY, driftScale);
        }
    };

    const fullPageBloom = (count) => {
        if (!blossomLayer) return;
        const width = window.innerWidth || document.documentElement.clientWidth || 1280;
        const height = window.innerHeight || document.documentElement.clientHeight || 720;
        const petals = typeof count === 'number' ? count : (prefersReducedMotion ? 80 : 160);

        for (let i = 0; i < petals; i += 1) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const driftScale = 0.6 + Math.random() * 1.1;
            createBlossomPetal(x, y, driftScale);
        }
    };

    const startBlossomRain = () => {
        if (blossomRainTimer) return;
        rainBlossoms();
        blossomRainTimer = window.setInterval(rainBlossoms, prefersReducedMotion ? 700 : 320);
    };

    const startFullBloom = () => {
        if (blossomBloomTimer) return;
        const spawnInterval = prefersReducedMotion ? 200 : 120;
        const petalsPerTick = prefersReducedMotion ? 1 : 3;

        blossomBloomTimer = window.setInterval(() => {
            if (!blossomLayer) return;
            const width = window.innerWidth || document.documentElement.clientWidth || 1280;
            for (let i = 0; i < petalsPerTick; i += 1) {
                const x = Math.random() * width;
                const y = -10 - Math.random() * 40;
                const driftScale = 0.6 + Math.random() * 1.1;
                createBlossomPetal(x, y, driftScale);
            }
        }, spawnInterval);
    };

    const stopBlossomRain = () => {
        if (blossomRainTimer) {
            window.clearInterval(blossomRainTimer);
            blossomRainTimer = null;
        }
        if (blossomBloomTimer) {
            window.clearInterval(blossomBloomTimer);
            blossomBloomTimer = null;
        }
        blossomLayer.querySelectorAll('.blossom-petal').forEach((petal) => petal.remove());
    };

    const initialBlossomMode = !prefersReducedMotion && localStorage.getItem(blossomKey) === '1';
    setBlossomMode(initialBlossomMode);
    if (initialBlossomMode) {
        startBlossomRain();
        startFullBloom();
    }

    if (blossomToggle) {
        blossomToggle.addEventListener('click', () => {
            const nextState = !document.body.classList.contains('blossom-mode');
            setBlossomMode(nextState);
            if (nextState) {
                fullPageBloom(prefersReducedMotion ? 40 : 100);
                burstBlossoms(blossomToggle);
                startBlossomRain();
                startFullBloom();
            } else {
                stopBlossomRain();
            }
        });
        if (prefersReducedMotion) {
            blossomToggle.title = 'Reduced-motion blossoms — click to enable a gentle effect';
        }
    }

    const animateCounter = (element) => {
        const target = Number(element.getAttribute('data-count') || '0');
        const duration = 1100;
        const start = performance.now();

        const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            element.textContent = `${Math.round(eased * target)}`;
            if (progress < 1) {
                requestAnimationFrame(tick);
            }
        };

        requestAnimationFrame(tick);
    };

    const markVisible = (element) => {
        element.classList.add('is-visible');
        element.querySelectorAll('[data-count]').forEach((counter) => {
            if (!counter.dataset.countAnimated) {
                counter.dataset.countAnimated = 'true';
                animateCounter(counter);
            }
        });
    };

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
        revealTargets.forEach(markVisible);
    } else {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                markVisible(entry.target);
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

        revealTargets.forEach((target) => observer.observe(target));
    }

    landingLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            let targetHref = link.getAttribute('href');
            if (!targetHref || targetHref.startsWith('#')) return;
            // The link is natively app.html now. No need to intercept and rewrite URLs.

            event.preventDefault();
            document.body.classList.add('is-leaving');
            window.setTimeout(() => {
                window.location.href = targetHref;
            }, 180);
        });
    });
})();

window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        document.body.classList.remove('is-leaving');
    }
});
