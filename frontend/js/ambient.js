/**
 * Ambient Sanctuary Logic for BiblioDrift
 * Handles background ambient sounds (Rain, Fireplace) with volume control.
 */

class AmbientManager {
    constructor() {
        this.toggleBtn = document.getElementById('ambientToggle');
        this.panel = document.getElementById('ambientPanel');
        this.rainToggle = document.getElementById('rainToggle');
        this.fireToggle = document.getElementById('fireToggle');
        this.volumeSlider = document.getElementById('ambientVolume');
        this.birdToggle = document.getElementById('birdToggle');
        this.oceanToggle = document.getElementById('oceanToggle');
        this.chimesToggle = document.getElementById('chimesToggle');
        this.pianoToggle = document.getElementById('pianoToggle');

        // Defensive check: only initialize if elements exist
        if (!this.toggleBtn || !this.panel) return;

        this.rainAudio = new Audio('https://archive.org/download/Red_Library_Nature_Rain/R22-25-General%20Rain.mp3');
        this.fireAudio = new Audio('https://archive.org/download/1-hour-cozy-fire-crackling-fireplace-320/1%20hour%20Cozy%20Fire%20Crackling%20Fireplace%20320.mp3');
        this.birdAudio = new Audio('../assets/sounds/bird.mp3');
        this.oceanAudio = new Audio('../assets/sounds/ocean.mp3');
        this.chimesAudio = new Audio('../assets/sounds/softchimes.mp3');
        this.pianoAudio = new Audio('../assets/sounds/piano.mp3');
        
        
        this.rainAudio.loop = true;
        this.fireAudio.loop = true;
        this.birdAudio.loop = true;
        this.oceanAudio.loop = true;
        this.chimesAudio.loop = true;
        this.pianoAudio.loop = true;

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
            console.log("Audio Context Unlocked");
            this.audioUnlocked = true;
            window.removeEventListener('click', this.unlockAudio);
        };
        window.addEventListener('click', this.unlockAudio);

        this.init();
        // Ensure volume is set immediately
        this.rainAudio.volume = 0.5;
        this.fireAudio.volume = 0.5;
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

        // Bird Toggle
        this.birdToggle.addEventListener('change',()=>{
            if(this.birdToggle.checked){
                this.birdAudio.currentTime = 0;
                this.birdAudio.play()
                    .then(() => console.log("Bird audio playing"))
                    .catch(e => {
                        console.error("Bird audio failed:", e);
                    });
            } else {
                this.birdAudio.pause();
            }
        })
        //Ocean Toggle
        this.oceanToggle.addEventListener('change',()=>{
            if(this.oceanToggle.checked){
                this.oceanAudio.currentTime = 0;
                this.oceanAudio.play()
                    .then(() => console.log("Ocean audio playing"))
                    .catch(e => {
                        console.error("Ocean audio failed:", e);
                    });
            } else {
                this.oceanAudio.pause();
            }
        })
        //Chimes Toggle
        this.chimesToggle.addEventListener('change',()=>{
            if(this.chimesToggle.checked){
                this.chimesAudio.currentTime = 0;
                this.chimesAudio.play()
                    .then(() => console.log("Chimes audio playing"))
                    .catch(e => {
                        console.error("Chimes audio failed:", e);
                    });
            } else { this.chimesAudio.pause(); 
            }
        })
        //Piano Toggle
        this.pianoToggle.addEventListener('change',()=>{
            if(this.pianoToggle.checked){
                this.pianoAudio.currentTime = 0;
                this.pianoAudio.play()
                    .then(() => console.log("Piano audio playing"))
                    .catch(e => {
                        console.error("Piano audio failed:", e);
                    });
            } else { this.pianoAudio.pause();
            }
        })

        // Volume Control
        this.volumeSlider.addEventListener('input', () => {
            const volume = parseFloat(this.volumeSlider.value);
            this.rainAudio.volume = volume;
            this.fireAudio.volume = volume;
            this.birdAudio.volume = volume;
            this.oceanAudio.volume = volume;
            this.chimesAudio.volume = volume;
            this.pianoAudio.volume = volume;
        });

        // Initial sync
        const startVolume = parseFloat(this.volumeSlider.value) || 0.5;
        this.rainAudio.volume = startVolume;
        this.fireAudio.volume = startVolume;
        this.birdAudio.volume = startVolume;
        this.oceanAudio.volume = startVolume;
        this.chimesAudio.volume = startVolume;
        this.pianoAudio.volume = startVolume;
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.ambientManager = new AmbientManager();
});
