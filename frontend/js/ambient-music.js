/**
 * Mood-based Ambient Music mini-player for BiblioDrift.
 * Listens for mood-search responses (window event) and swaps the Spotify
 * embed inside a glassmorphic floating panel, styled after Ambient Sanctuary.
 * Hidden until the first search provides an ambient_music payload.
 */

class AmbientMusicPlayer {
    constructor() {
        this.root = document.getElementById('musicPlayer');
        this.toggleBtn = document.getElementById('musicToggle');
        this.panel = document.getElementById('musicPanel');
        this.embed = document.getElementById('musicEmbed');
        this.genreLabel = document.getElementById('musicGenre');
        this.emptyMsg = document.getElementById('musicEmpty');

        if (!this.root || !this.toggleBtn || !this.panel || !this.embed) return;

        this.toggleBtn.setAttribute('aria-controls', 'musicPanel');
        this.currentUrl = null;

        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = this.panel.classList.toggle('active');
            this.toggleBtn.classList.toggle('active', isActive);
            this.toggleBtn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        });

        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && e.target !== this.toggleBtn && !this.toggleBtn.contains(e.target)) {
                this.panel.classList.remove('active');
                this.toggleBtn.classList.remove('active');
                this.toggleBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // app.js dispatches this after every mood-search API response
        window.addEventListener('bibliodrift:ambient-music', (e) => this.update(e.detail));
    }

    update(ambientMusic) {
        if (!ambientMusic || !ambientMusic.spotify_embed_url) return;
        if (ambientMusic.spotify_embed_url === this.currentUrl) return;
        this.currentUrl = ambientMusic.spotify_embed_url;
        this.embed.src = `${ambientMusic.spotify_embed_url}?utm_source=generator&theme=0`;
        this.embed.style.display = 'block';
        if (this.emptyMsg) this.emptyMsg.style.display = 'none';
        if (this.genreLabel && ambientMusic.genre) {
            this.genreLabel.textContent = `Now vibing: ${ambientMusic.genre}`;
        }
        this.root.hidden = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ambientMusicPlayer = new AmbientMusicPlayer();
});
