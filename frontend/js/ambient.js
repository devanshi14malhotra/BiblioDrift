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

        // ARIA: connect toggle to panel and set initial state
        this.toggleBtn.setAttribute('aria-controls', 'ambientPanel');
        this.toggleBtn.setAttribute('aria-expanded', 'false');

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
        // Toggle Panel with ARIA and button active animation
        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.unlockAudio(); // Explicitly unlock audio here since propagation is stopped!
            const isActive = this.panel.classList.toggle('active');
            // mirror state on the button for styling and accessibility
            this.toggleBtn.classList.toggle('active', isActive);
            this.toggleBtn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        });

        // Close panel when clicking outside (and update ARIA/button state)
        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && e.target !== this.toggleBtn) {
                const wasActive = this.panel.classList.contains('active');
                this.panel.classList.remove('active');
                if (wasActive) {
                    this.toggleBtn.classList.remove('active');
                    this.toggleBtn.setAttribute('aria-expanded', 'false');
                }
            }
        });

        // Rain Toggle
        this.rainToggle.addEventListener('change', () => {
            if (this.rainToggle.checked) {
                if (typeof setTheme === 'function') setTheme('rainy');
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
                if (typeof clearTheme === 'function') clearTheme();
                this.rainAudio.pause();
            }
        });

        // Fire Toggle
        this.fireToggle.addEventListener('change', () => {
            if (this.fireToggle.checked) {
                if (typeof setTheme === 'function') setTheme('cozy');
                this.fireAudio.currentTime = 0;
                this.fireAudio.play()
                    .then(() => console.log("Fire audio playing"))
                    .catch(e => {
                        console.error("Fire audio failed:", e);
                    });
            } else {
                if (typeof clearTheme === 'function') clearTheme();
                this.fireAudio.pause();
            }
        });

        // Ocean Waves Toggle
        this.oceanToggle.addEventListener('change', () => {
            if (this.oceanToggle.checked) {
                if (typeof setTheme === 'function') setTheme('ocean');
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
                if (typeof clearTheme === 'function') clearTheme();
                this.oceanAudio.pause();
            }
        });

        // Stormy Rain Toggle
        this.stormToggle.addEventListener('change', () => {
            if (this.stormToggle.checked) {
                if (typeof setTheme === 'function') setTheme('stormy');
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
                if (typeof clearTheme === 'function') clearTheme();
                this.stormAudio.pause();
            }
        });

        // Volume Control
        this.updateVolumeUI = (val) => {
            const pct = Math.round((val || 0) * 100);
            // update track fill using numeric CSS variable (0-100)
            // JS sets a number so CSS can calc offsets (percent + px)
            this.volumeSlider.style.setProperty('--ambient-fill', `${pct}`);
            // add transient class to animate thumb pop
            this.volumeSlider.classList.add('volume-animate');
            clearTimeout(this._volAnimTimeout);
            this._volAnimTimeout = setTimeout(() => {
                this.volumeSlider.classList.remove('volume-animate');
            }, 380);
        };

        this.volumeSlider.addEventListener('input', () => {
            const volume = parseFloat(this.volumeSlider.value);
            this.rainAudio.volume = volume;
            this.fireAudio.volume = volume;
            this.oceanAudio.volume = volume;
            this.stormAudio.volume = volume;
            this.updateVolumeUI(volume);
        });

        // cache the fill element for the track (if present)
        this.rangeFill = this.panel.querySelector('.volume-control .range-fill');

        // Also attempt to play any checked audio immediately on input (more responsive than 'change')
        this.volumeSlider.addEventListener('input', () => {
            const vol = parseFloat(this.volumeSlider.value);
            console.log('Ambient volume (input):', vol, 'rain paused?', this.rainAudio.paused, 'fire paused?', this.fireAudio.paused);
            const tryPlayNow = (audio, toggle) => {
                if (!toggle) return;
                if (toggle.checked) {
                    audio.volume = vol;
                    audio.play().catch(e => {
                        // log at debug level; autoplay policies may block play()
                        console.debug('Play attempt blocked:', e);
                    });
                }
            };

            tryPlayNow(this.rainAudio, this.rainToggle);
            tryPlayNow(this.fireAudio, this.fireToggle);
            tryPlayNow(this.oceanAudio, this.oceanToggle);
            tryPlayNow(this.stormAudio, this.stormToggle);

            // update overlay fill width if element exists
            if (this.rangeFill) {
                const pct = Math.round(vol * 100);
                this.rangeFill.style.width = pct + '%';
            }
        });

        // Ensure any enabled ambient sound starts playing when the user adjusts volume
        this.volumeSlider.addEventListener('change', () => {
            const vol = parseFloat(this.volumeSlider.value);
            // Debug log to help trace issues where volume changes but no sound is heard
            console.log('Ambient volume set to', vol);

            const tryPlay = (audio, toggle) => {
                if (!toggle) return;
                if (toggle.checked) {
                    // If audio is paused, try to play at the new volume
                    if (audio.paused) {
                        audio.play().catch(e => {
                            // ignore play errors (browser autoplay policy) but log for debugging
                            console.debug('Ambient audio play blocked or failed:', e);
                        });
                    }
                }
            };

            tryPlay(this.rainAudio, this.rainToggle);
            tryPlay(this.fireAudio, this.fireToggle);
            tryPlay(this.oceanAudio, this.oceanToggle);
            tryPlay(this.stormAudio, this.stormToggle);
        });

        // Initial sync
        const startVolume = parseFloat(this.volumeSlider.value) || 0.5;
        this.rainAudio.volume = startVolume;
        this.fireAudio.volume = startVolume;
        this.oceanAudio.volume = startVolume;
        this.stormAudio.volume = startVolume;
        // initialize UI fill
        this.updateVolumeUI(startVolume);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.ambientManager = new AmbientManager();
});

(function () {
  'use strict';

  const isTouchOnly = window.matchMedia('(hover: none)').matches;

  function getColors() {
    const isNight = document.documentElement.getAttribute('data-theme') === 'night';
    const COLORS_LIGHT = ['#5D4037','#4A362E','#6D4C41','#3E2723','#8D6E63','#5C4033'];
    const COLORS_NIGHT = ['#E8D5B7','#C9A87C','#F0E0C8','#B8956A','#D4B896','#F5ECD8'];
    return isNight ? COLORS_NIGHT : COLORS_LIGHT;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function spawnSparkle(x, y) {
    const el    = document.createElement('div');
    const color = pick(getColors());
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

