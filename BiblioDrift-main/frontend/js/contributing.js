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
