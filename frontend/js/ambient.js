/**
 * Ambient Sanctuary Logic for BiblioDrift
 * Handles background ambient sounds (Rain, Fireplace, Ocean) with volume control.
 */

class AmbientManager {
    constructor() {
        this.toggleBtn = document.getElementById('ambientToggle');
        this.panel = document.getElementById('ambientPanel');
        this.rainToggle = document.getElementById('rainToggle');
        this.fireToggle = document.getElementById('fireToggle');
        this.oceanToggle = document.getElementById('oceanToggle');
        this.stormToggle = document.getElementById('stormToggle');
        this.volumeSlider = document.getElementById('ambientVolume');

        // Defensive check: only initialize if elements exist
        if (!this.toggleBtn || !this.panel) return;

        this.rainAudio = new Audio('https://archive.org/download/Red_Library_Nature_Rain/R22-25-General%20Rain.mp3');
        this.rainAudio.preload = 'auto';
        this.fireAudio = new Audio('https://archive.org/download/1-hour-cozy-fire-crackling-fireplace-320/1%20hour%20Cozy%20Fire%20Crackling%20Fireplace%20320.mp3');
        this.fireAudio.preload = 'auto';
        this.oceanAudio = new Audio('../assets/sounds/calm-ocean-waves.mp3');
        this.oceanAudio.preload = 'auto';
        this.stormAudio = new Audio('../assets/sounds/Rain-and-storm.mp3');
        this.stormAudio.preload = 'auto';
        
        this.rainAudio.loop = true;
        this.fireAudio.loop = true;
        this.oceanAudio.loop = true;
        this.stormAudio.loop = true;

        // Prevent the weird 'high bass' or thunder sound at the very end of the rain track
        // by artificially looping it a few seconds before the track actually ends.
        this.rainAudio.addEventListener('timeupdate', () => {
            // Cut off the last 4 seconds to bypass the microphone bump/thunder
            if (this.rainAudio.duration && this.rainAudio.currentTime >= this.rainAudio.duration - 4) {
                this.rainAudio.currentTime = 0;
                // Ensure it keeps playing after reset
                this.rainAudio.play().catch(e => {});
            }
        });

        // Global Audio Unlock (Required by modern browsers)
        this.audioUnlocked = false;
        this.unlockAudio = () => {
            if (this.audioUnlocked) return;
            this.rainAudio.play().then(() => { this.rainAudio.pause(); }).catch(e => {});
            this.fireAudio.play().then(() => { this.fireAudio.pause(); }).catch(e => {});
            this.oceanAudio.play().then(() => { this.oceanAudio.pause(); }).catch(e => {});
            console.log("Audio Context Unlocked");
            this.audioUnlocked = true;
            window.removeEventListener('click', this.unlockAudio);
        };
        window.addEventListener('click', this.unlockAudio);

        this.init();
        // Ensure volume is set immediately
        this.rainAudio.volume = 0.5;
        this.fireAudio.volume = 0.5;
        this.oceanAudio.volume = 0.5;
    }

    init() {
        // Toggle Panel
        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.unlockAudio(); // Explicitly unlock audio here since propagation is stopped!
            this.panel.classList.toggle('active');
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && e.target !== this.toggleBtn) {
                this.panel.classList.remove('active');
            }
        });

        // Rain Toggle
        this.rainToggle.addEventListener('change', () => {
            if (this.rainToggle.checked) {
                this.rainAudio.currentTime = 0;
                this.rainAudio.play()
                    .then(() => console.log("Rain audio playing"))
                    .catch(e => {
                        console.error("Rain audio failed:", e);
                        if (typeof showToast === 'function') {
                            showToast("Audio playback blocked. Click anywhere to enable.", "info");
                        }
                    });
            } else {
                this.rainAudio.pause();
            }
        });

        // Fire Toggle
        this.fireToggle.addEventListener('change', () => {
            if (this.fireToggle.checked) {
                this.fireAudio.currentTime = 0;
                this.fireAudio.play()
                    .then(() => console.log("Fire audio playing"))
                    .catch(e => {
                        console.error("Fire audio failed:", e);
                    });
            } else {
                this.fireAudio.pause();
            }
        });

        // Ocean Waves Toggle
        this.oceanToggle.addEventListener('change', () => {
            if (this.oceanToggle.checked) {
                this.oceanAudio.currentTime = 0;
                this.oceanAudio.play()
                    .then(() => console.log("Ocean audio playing"))
                    .catch(e => {
                        console.error("Ocean audio failed:", e);
                        if (typeof showToast === 'function') {
                            showToast("Audio playback blocked. Click anywhere to enable.", "info");
                        }
                    });
            } else {
                this.oceanAudio.pause();
            }
        });

        // Stormy Rain Toggle
        this.stormToggle.addEventListener('change', () => {
            if (this.stormToggle.checked) {
                this.stormAudio.currentTime = 0;
                this.stormAudio.play()
                    .then(() => console.log("Storm audio playing"))
                    .catch(e => {
                        console.error("Storm audio failed:", e);
                        if (typeof showToast === 'function') {
                            showToast("Audio playback blocked. Click anywhere to enable.", "info");
                        }
                    });
            } else {
                this.stormAudio.pause();
            }
        });

        // Volume Control
        this.volumeSlider.addEventListener('input', () => {
            const volume = parseFloat(this.volumeSlider.value);
            this.rainAudio.volume = volume;
            this.fireAudio.volume = volume;
            this.oceanAudio.volume = volume;
            this.stormAudio.volume = volume;
        });

        // Initial sync
        const startVolume = parseFloat(this.volumeSlider.value) || 0.5;
        this.rainAudio.volume = startVolume;
        this.fireAudio.volume = startVolume;
        this.oceanAudio.volume = startVolume;
        this.stormAudio.volume = startVolume;
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.ambientManager = new AmbientManager();
});

(function () {
  'use strict';

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isTouchOnly = window.matchMedia('(hover: none)').matches;

  const COLORS_LIGHT = ['#B46A2A','#C8844E','#D49A60','#A05A20','#E0B080','#C87840'];
  const COLORS_DARK  = ['#E8D5B7','#C9A87C','#F0E0C8','#B8956A','#D4B896','#F5ECD8'];
  const COLORS = isDark ? COLORS_DARK : COLORS_LIGHT;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function spawnSparkle(x, y) {
    const el    = document.createElement('div');
    const color = pick(COLORS);
    const size  = rand(10, 22);
    const angle = rand(0, Math.PI * 2);
    const dist  = rand(20, 55);

    el.className = 'sc-sparkle';
    el.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    el.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.animationDuration = rand(0.5, 0.9) + 's';
    el.style.animationDelay   = rand(0, 0.06) + 's';

    const type = Math.random();
    if (type < 0.5) {
      el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 20 20">
        <path d="M10 1 L11.5 8.5 L19 10 L11.5 11.5 L10 19 L8.5 11.5 L1 10 L8.5 8.5 Z"
          fill="${color}" opacity="0.9"/></svg>`;
    } else if (type < 0.75) {
      const s = size * 0.7;
      el.innerHTML = `<svg width="${s}" height="${s}" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="5" fill="${color}" opacity="0.85"/>
        <line x1="7" y1="0" x2="7" y2="14" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
        <line x1="0" y1="7" x2="14" y2="7" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
        </svg>`;
    } else {
      const s = size * 0.8;
      el.innerHTML = `<svg width="${s}" height="${s}" viewBox="0 0 20 20">
        <polygon points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8"
          fill="${color}" opacity="0.9"/></svg>`;
    }

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function burst(x, y, count) {
    for (let i = 0; i < count; i++) spawnSparkle(x, y);
  }

  /* ── Inject the glow DOM elements if not already in HTML ── */
  function injectGlowElements() {
    if (document.getElementById('sc-glow-outer')) return;
    ['sc-glow-outer', 'sc-glow-mid', 'sc-glow-inner', 'sc-dot'].forEach(id => {
      const el = document.createElement('div');
      el.id = id;
      document.body.prepend(el);
    });
  }

  function initDesktop() {
    injectGlowElements();

    const glowOuter = document.getElementById('sc-glow-outer');
    const glowMid   = document.getElementById('sc-glow-mid');
    const glowInner = document.getElementById('sc-glow-inner');
    const dot       = document.getElementById('sc-dot');

    let mx = innerWidth / 2, my = innerHeight / 2;
    let ox = mx, oy = my;
    let midx = mx, midy = my;
    let inx = mx, iny = my;
    let lastSx = mx, lastSy = my;
    let accum = 0;

    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

    (function loop() {
      ox   = lerp(ox,   mx, 0.08);  oy   = lerp(oy,   my, 0.08);
      midx = lerp(midx, mx, 0.14);  midy = lerp(midy, my, 0.14);
      inx  = lerp(inx,  mx, 0.22);  iny  = lerp(iny,  my, 0.22);

      glowOuter.style.left = ox   + 'px'; glowOuter.style.top = oy   + 'px';
      glowMid.style.left   = midx + 'px'; glowMid.style.top   = midy + 'px';
      glowInner.style.left = inx  + 'px'; glowInner.style.top = iny  + 'px';
      dot.style.left = mx + 'px';         dot.style.top = my + 'px';

      const dx = mx - lastSx, dy = my - lastSy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      accum += dist;

      while (accum >= 12) {
        accum -= 12;
        const t = Math.random();
        spawnSparkle(lastSx + dx * t, lastSy + dy * t);
      }

      if (dist > 0) { lastSx = mx; lastSy = my; }

      requestAnimationFrame(loop);
    })();
  }
  
  function initMobile() {
    document.addEventListener('touchstart', function (e) {
      Array.from(e.changedTouches).forEach(t => {
        burst(t.clientX, t.clientY, 8);
      });
    }, { passive: true });
  }

  /* ── Init ── */
  if (isTouchOnly) {
    initMobile();
  } else {
    initDesktop();
  }

})();

