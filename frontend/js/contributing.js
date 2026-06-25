/**
 * Contributing Page Interactions
 * Handles scroll reveal animations, smooth scrolling with active nav link highlighting, and back-to-top button
 */

(function(){
    const revealTargets = document.querySelectorAll('.reveal');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const markVisible = (element) => {
        element.classList.add('is-visible');
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
})();

(function(){
    const navLinks = document.querySelectorAll('.landing-nav a');
    const backToTopBtn = document.getElementById('backToTop');

    const handleNavLinkClick = (event) => {
        if (event.target.tagName !== 'A') return;

        const href = event.target.getAttribute('href');
        if (!href || !href.startsWith('#')) return;

        event.preventDefault();

        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);
        if (!targetElement) return;

        navLinks.forEach(link => link.classList.remove('active'));
        event.target.classList.add('active');

        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleScroll = () => {
        const scrolled = window.scrollY || document.documentElement.scrollTop;

        if (scrolled > 300) {
            if (backToTopBtn && backToTopBtn.style.display !== 'flex') {
                backToTopBtn.style.display = 'flex';
            }
        } else {
            if (backToTopBtn && backToTopBtn.style.display !== 'none') {
                backToTopBtn.style.display = 'none';
            }
        }

        const currentTarget = Array.from(navLinks)
            .filter(link => {
                const href = link.getAttribute('href');
                if (!href || !href.startsWith('#')) return false;
                const targetId = href.substring(1);
                const element = document.getElementById(targetId);
                if (!element) return false;
                const rect = element.getBoundingClientRect();
                return rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2;
            })
            .pop();

        navLinks.forEach(link => link.classList.remove('active'));
        if (currentTarget) {
            currentTarget.classList.add('active');
        }
    };

    document.addEventListener('click', handleNavLinkClick);
    window.addEventListener('scroll', handleScroll, { passive: true });

    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        backToTopBtn.style.display = 'none';
    }

    handleScroll();
})();

// Theme Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        // Initial icon state
        if (document.documentElement.getAttribute('data-theme') === 'night') {
            icon.className = 'fa-solid fa-sun';
        }
        
        themeToggle.addEventListener('click', () => {
            const isNight = document.documentElement.getAttribute('data-theme') === 'night';
            if (isNight) {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('bibliodrift_theme', 'light');
                icon.className = 'fa-solid fa-moon';
            } else {
                document.documentElement.setAttribute('data-theme', 'night');
                localStorage.setItem('bibliodrift_theme', 'night');
                icon.className = 'fa-solid fa-sun';
            }
        });
    }
});

/**
 * Pencil Cursor Animation
 * Adds an interactive pencil cursor effect with trailing particles
 * Responsive for different screen sizes and disabled on touch devices
 */
(function() {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Check if device supports hover (has mouse/trackpad, not just touch)
    const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (touchOnly) return; // Disable on touch-only devices

    let lastX = 0;
    let lastY = 0;
    let lastTrailTime = 0;
    
    // Responsive trail interval based on screen size
    let trailInterval = 15; // milliseconds between trail particles (default for desktop)
    if (window.innerWidth <= 768) {
        trailInterval = 20; // Slightly less frequent on tablets
    }
    if (window.innerWidth <= 480) {
        trailInterval = 25; // Even less frequent on mobile for performance
    }

    // Determine particle size based on screen size
    let particleSize = 6; // for 12px particles (12/2 = 6)
    if (window.innerWidth <= 768) {
        particleSize = 5; // for 10px particles
    }
    if (window.innerWidth <= 480) {
        particleSize = 4; // for 8px particles
    }

    // Determine mark size based on screen size
    let markSize = 2.5; // for 5px marks (5/2 = 2.5)
    if (window.innerWidth <= 768) {
        markSize = 2; // for 4px marks
    }
    if (window.innerWidth <= 480) {
        markSize = 1.5; // for 3px marks
    }

    /**
     * Create a trail particle at the cursor position
     */
    function createTrailParticle(x, y) {
        const trail = document.createElement('div');
        trail.className = 'pencil-trail';
        trail.style.left = (x - particleSize) + 'px'; // center the particle
        trail.style.top = (y - particleSize) + 'px';
        
        // Random slight offset for organic feel (responsive offset)
        const maxOffset = window.innerWidth <= 480 ? 4 : 8;
        const offsetX = (Math.random() - 0.5) * maxOffset;
        const offsetY = (Math.random() - 0.5) * maxOffset;
        trail.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        
        document.body.appendChild(trail);

        // Remove particle after animation completes
        setTimeout(() => trail.remove(), 1000);
    }

    /**
     * Create a draw mark for occasional marks along the trail
     */
    function createDrawMark(x, y) {
        const mark = document.createElement('div');
        mark.className = 'pencil-draw-mark';
        mark.style.left = (x - markSize) + 'px'; // center the mark
        mark.style.top = (y - markSize) + 'px';
        
        // Random slight offset (responsive)
        const maxOffset = window.innerWidth <= 480 ? 2 : 4;
        const offsetX = (Math.random() - 0.5) * maxOffset;
        const offsetY = (Math.random() - 0.5) * maxOffset;
        mark.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        
        document.body.appendChild(mark);

        // Remove mark after animation completes
        setTimeout(() => mark.remove(), 1200);
    }

    /**
     * Calculate distance between two points
     */
    function getDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    /**
     * Handle mouse move for pencil trail effect
     */
    function handleMouseMove(e) {
        const x = e.clientX;
        const y = e.clientY;

        // Calculate distance moved
        const distance = getDistance(lastX, lastY, x, y);

        // Create trail particles at intervals
        const now = Date.now();
        if (now - lastTrailTime > trailInterval) {
            createTrailParticle(x, y);
            lastTrailTime = now;

            // Occasionally create a draw mark for pencil marks effect
            if (Math.random() > 0.5) {
                createDrawMark(x, y);
            }
        }

        lastX = x;
        lastY = y;
    }

    /**
     * Handle mouse leave to clean up
     */
    function handleMouseLeave() {
        lastX = 0;
        lastY = 0;
    }

    // Attach event listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    // Handle window resize to update responsive values
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Update trail interval on resize
            if (window.innerWidth <= 480) {
                trailInterval = 25;
                particleSize = 4;
                markSize = 1.5;
            } else if (window.innerWidth <= 768) {
                trailInterval = 20;
                particleSize = 5;
                markSize = 2;
            } else {
                trailInterval = 15;
                particleSize = 6;
                markSize = 2.5;
            }
        }, 250); // Debounce resize handler
    }, { passive: true });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseleave', handleMouseLeave);
    });
})();
