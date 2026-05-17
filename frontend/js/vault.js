/* --- VAULT CORE CONTROLLER & IMMERSIVE AUDIO ENGINE ---
   Author: Antigravity AI pair-programmer
   Stack: Vanilla HTML5 / ES6 Classes / Dexie.js / PDF.js / Ambient Audio Nodes
-------------------------------------------------- */

// Configure PDF.js Global Worker for background parsing threads
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

// Preset Ambiance Loops from stable open CDN tracks
const AUDIO_SOURCES = {
    rain: 'https://archive.org/download/ambient-rain-loop-1/ambient-rain-loop-1.mp3',
    fireplace: 'https://archive.org/download/cozy-fireplace-loop/cozy-fireplace-loop.mp3',
    vinyl: 'https://archive.org/download/vinyl-crackle-loop/vinyl-crackle-loop.mp3',
    cafe: 'https://archive.org/download/cozy-cafe-ambience-loop/cozy-cafe-ambience-loop.mp3',
    piano: 'https://archive.org/download/soft-piano-improvisation-loop/soft-piano-improvisation-loop.mp3',
    waves: 'https://archive.org/download/gentle-ocean-waves-loop/gentle-ocean-waves-loop.mp3'
};

// SVG Base64 Spine Fallbacks for personalized bookcase covers
const BOOKCASE_COVERS = [
    'linear-gradient(90deg, #5c2016 0%, #892c1b 20%, #892c1b 80%, #5c2016 100%)', // Burgundy
    'linear-gradient(90deg, #1b365d 0%, #2a4d8c 20%, #2a4d8c 80%, #1b365d 100%)', // Library Blue
    'linear-gradient(90deg, #1e3f20 0%, #2d5a30 20%, #2d5a30 80%, #1e3f20 100%)', // Sage Green
    'linear-gradient(90deg, #422d56 0%, #5a4275 20%, #5a4275 80%, #422d56 100%)', // Dark Plum
    'linear-gradient(90deg, #7c522b 0%, #9c6c3e 20%, #9c6c3e 80%, #7c522b 100%)'  // Aged Leather
];

class VaultSanctuary {
    constructor() {
        this.selectedFileBlob = null;
        this.currentReadingBook = null;
        this.pdfDocumentInstance = null;
        this.currentReaderPageNum = 1;
        this.totalReaderPages = 1;
        this.isReaderRendering = false;
        
        // Initialize Core Subsystems
        this.initDustParticles();
        this.initAmbientMixer();
        this.initDB();
        this.bindEvents();
        this.loadBookshelf();
        
        // Spawn Floating Quotes Loop
        this.startQuoteRotator();
    }

    /* ====================================================
       1. COSMETIC: LIGHTING & DUST FLOATING PARTICLES
       ==================================================== */
    initDustParticles() {
        const container = document.getElementById('dustParticles');
        if (!container) return;
        
        const count = 35;
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'dust-particle';
            
            // Randomize spawn dimensions and drifting velocities
            particle.style.left = `${Math.random() * 100}vw`;
            particle.style.animationDelay = `${Math.random() * 20}s`;
            particle.style.animationDuration = `${12 + Math.random() * 15}s`;
            particle.style.transform = `scale(${0.5 + Math.random()})`;
            
            container.appendChild(particle);
        }
    }

    startQuoteRotator() {
        const quotes = [
            `"There is no barrier, obstacle, or chapel that can block the quiet sanctuary of the page."`,
            `"In a cozy nook of stories, time holds its breath and lets the world drift."`,
            `"Every archived book is a key to a candlelit sanctuary designed for your mind."`,
            `"Mix the rain, crackle the hearth, and let the letters carry you away."`
        ];
        const textElement = document.querySelector('.quote-text');
        if (!textElement) return;

        let index = 0;
        setInterval(() => {
            textElement.style.opacity = 0;
            setTimeout(() => {
                index = (index + 1) % quotes.length;
                textElement.innerText = quotes[index];
                textElement.style.opacity = 1;
            }, 1000);
        }, 12000);
    }

    /* ====================================================
       2. COZY MULTI-TRACK AUDIO MIXER ENGINE
       ==================================================== */
    initAmbientMixer() {
        this.audioTracks = {};
        this.isMixerMuted = false;
        
        // Pre-build HTML5 Audio tags
        Object.entries(AUDIO_SOURCES).forEach(([key, src]) => {
            const audio = new Audio(src);
            audio.loop = true;
            audio.crossOrigin = 'anonymous';
            this.audioTracks[key] = {
                element: audio,
                isPlaying: false,
                targetVolume: 0.5
            };
        });

        // Initialize sliders from DOM configurations
        document.querySelectorAll('.mixer-row').forEach(row => {
            const name = row.dataset.sound;
            const slider = row.querySelector('.sound-volume');
            if (this.audioTracks[name] && slider) {
                this.audioTracks[name].targetVolume = parseFloat(slider.value);
                this.audioTracks[name].element.volume = parseFloat(slider.value);
            }
        });
    }

    toggleSoundtrack(name, buttonElement) {
        const track = this.audioTracks[name];
        if (!track) return;

        if (track.isPlaying) {
            // Fade out elegantly
            this.fadeAudio(track.element, track.element.volume, 0, 500, () => {
                track.element.pause();
                track.isPlaying = false;
                buttonElement.innerHTML = '<i class="fa-solid fa-play"></i>';
                buttonElement.classList.remove('playing');
            });
        } else {
            // Play and Fade in
            track.element.volume = 0;
            track.element.play().then(() => {
                track.isPlaying = true;
                buttonElement.innerHTML = '<i class="fa-solid fa-pause"></i>';
                buttonElement.classList.add('playing');
                this.fadeAudio(track.element, 0, track.targetVolume, 500);
            }).catch(e => {
                console.warn('Audio streaming blocked by browser shields', e);
            });
        }
    }

    adjustSoundVolume(name, volumeVal) {
        const track = this.audioTracks[name];
        if (!track) return;
        
        track.targetVolume = parseFloat(volumeVal);
        if (track.isPlaying && !this.isMixerMuted) {
            track.element.volume = parseFloat(volumeVal);
        }
    }

    fadeAudio(audioElement, startVol, endVol, durationMs, callback = null) {
        const stepTime = 50;
        const steps = durationMs / stepTime;
        const volDiff = endVol - startVol;
        const volStep = volDiff / steps;
        
        let currentStep = 0;
        const interval = setInterval(() => {
            currentStep++;
            let nextVol = startVol + (volStep * currentStep);
            // Cap volumes safely
            nextVol = Math.max(0, Math.min(1, nextVol));
            audioElement.volume = nextVol;
            
            if (currentStep >= steps) {
                clearInterval(interval);
                audioElement.volume = endVol;
                if (callback) callback();
            }
        }, stepTime);
    }

    toggleMasterMute() {
        const btn = document.getElementById('btnToggleAllAmbiance');
        if (!btn) return;

        this.isMixerMuted = !this.isMixerMuted;
        
        Object.values(this.audioTracks).forEach(track => {
            if (track.isPlaying) {
                track.element.volume = this.isMixerMuted ? 0 : track.targetVolume;
            }
        });

        if (this.isMixerMuted) {
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            btn.classList.add('muted');
        } else {
            btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            btn.classList.remove('muted');
        }
    }

    /* ====================================================
       3. STORAGE ARCHITECTURE (DEXIE UPGRADE)
       ==================================================== */
    initDB() {
        if (!window.db) {
            window.db = new Dexie("BiblioDriftDB");
            window.db.version(2).stores({
                books: 'id, title, author, content, mood, coverUrl',
                vault_books: 'id, title, author, visibility, mood, addedAt'
            });
        }
    }

    /* ====================================================
       4. BIND UI INTERACTION INTERFACES
       ==================================================== */
    bindEvents() {
        // Drag & Drop bindings
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const browseLink = document.querySelector('.browse-link');
        
        if (dropZone && fileInput) {
            browseLink?.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
            });
            
            dropZone.addEventListener('click', () => fileInput.click());
            
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files.length) {
                    this.handleFileSelection(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) {
                    this.handleFileSelection(e.target.files[0]);
                }
            });
        }

        // Ambiance Volume Mixer bindings
        document.querySelectorAll('.mixer-row').forEach(row => {
            const soundName = row.dataset.sound;
            const playToggle = row.querySelector('.sound-toggle');
            const slider = row.querySelector('.sound-volume');
            
            playToggle?.addEventListener('click', () => this.toggleSoundtrack(soundName, playToggle));
            slider?.addEventListener('input', (e) => this.adjustSoundVolume(soundName, e.target.value));
        });

        // Master Mute
        document.getElementById('btnToggleAllAmbiance')?.addEventListener('click', () => this.toggleMasterMute());

        // Metadata form submit
        const metadataForm = document.getElementById('metadataForm');
        metadataForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveBookToSanctuary();
        });

        // Scroll Anchors
        document.getElementById('btnScrollUpload')?.addEventListener('click', () => {
            document.getElementById('uploadPanel')?.scrollIntoView({ behavior: 'smooth' });
        });
        document.getElementById('btnScrollPublic')?.addEventListener('click', () => {
            document.getElementById('publicAlcove')?.scrollIntoView({ behavior: 'smooth' });
        });

        // Cozy Reader Modals bindings
        document.getElementById('btnPrevPage')?.addEventListener('click', () => this.navigatePage(-1));
        document.getElementById('btnNextPage')?.addEventListener('click', () => this.navigatePage(1));
        document.getElementById('btnReaderClose')?.addEventListener('click', () => this.closeReadingSanctuary());
        
        // Fullscreen Mode Toggle
        document.getElementById('btnReaderFullscreen')?.addEventListener('click', () => {
            const readerModal = document.getElementById('readerDialog');
            if (!document.fullscreenElement) {
                readerModal?.requestFullscreen().catch(err => {
                    console.warn(`Fullscreen error: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });

        // Sepia / Night Reader Mode Toggle
        document.getElementById('btnReaderModeToggle')?.addEventListener('click', () => {
            const readerModal = document.getElementById('readerDialog');
            if (readerModal) {
                const currentTheme = readerModal.getAttribute('data-reader-theme');
                const nextTheme = currentTheme === 'night' ? 'sepia' : 'night';
                readerModal.setAttribute('data-reader-theme', nextTheme);
            }
        });

        // Close Warning Moderations
        document.getElementById('btnCloseModeration')?.addEventListener('click', () => {
            document.getElementById('moderationDialog')?.close();
        });

        // Quick Continue Resume button
        document.getElementById('btnContinueReading')?.addEventListener('click', () => {
            if (this.currentReadingBook) {
                this.launchReadingSanctuary(this.currentReadingBook);
            }
        });
    }

    /* ====================================================
       5. PDF UPLOAD AND ELARA SAFETY SCANNING
       ==================================================== */
    handleFileSelection(file) {
        if (!file) return;

        // Reset forms
        document.getElementById('metadataFormCard').setAttribute('hidden', '');
        document.getElementById('elaraScanner').setAttribute('hidden', '');

        // 1. PDF Mime Safety check
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
            this.triggerElaraModeration('Invalid Format: The sanctuary only stores PDF storybooks. Please verify and try again.');
            return;
        }

        // 2. Max File Size protect (15MB)
        const maxLimitBytes = 15 * 1024 * 1024;
        if (file.size > maxLimitBytes) {
            this.triggerElaraModeration('Heavy Archives: The book exceeds our 15MB sanctuary limit. Heavy archives cause browser memory stress.');
            return;
        }

        this.selectedFileBlob = file;

        // Trigger drag & drop progress loading animation
        const progressContainer = document.getElementById('uploadProgressContainer');
        const progressFill = document.getElementById('progressBarFill');
        const percentText = document.getElementById('uploadPercentage');
        const filenameText = document.getElementById('uploadFilename');

        filenameText.innerText = DOMPurify.sanitize(file.name);
        progressContainer.removeAttribute('hidden');
        progressFill.style.width = '0%';
        percentText.innerText = '0%';

        // Smoothly simulate file ingestion
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            progressFill.style.width = `${progress}%`;
            percentText.innerText = `${progress}%`;
            
            if (progress >= 100) {
                clearInterval(interval);
                // Trigger safety scanner
                this.triggerElaraScan();
            }
        }, 120);
    }

    triggerElaraScan() {
        const elaraScanner = document.getElementById('elaraScanner');
        const elaraText = document.getElementById('elaraStatusText');
        
        elaraScanner.removeAttribute('hidden');
        elaraText.innerHTML = '<i class="fa-solid fa-eye-low-vision animated-spin"></i> Elara is auditing book signatures and keywords...';

        setTimeout(() => {
            // Elara Keyword scanner check
            const nameLower = this.selectedFileBlob.name.toLowerCase();
            const badWords = ['malware', 'spam', 'hack', 'inappropriate', 'corrupted', 'virus'];
            const isUnsafe = badWords.some(word => nameLower.includes(word));

            if (isUnsafe) {
                elaraScanner.setAttribute('hidden', '');
                this.triggerElaraModeration('Safety Alert: Elara scanned unsafe keywords or corrupt structures inside this document.');
                this.selectedFileBlob = null;
                return;
            }

            elaraText.innerHTML = '<i class="fa-solid fa-circle-check gold-text"></i> safety scan clean! Suggesting ambiance styling...';
            
            // Pop the Metadata form
            setTimeout(() => {
                this.showMetadataForm();
            }, 800);

        }, 1500);
    }

    triggerElaraModeration(errorMessage) {
        const dialog = document.getElementById('moderationDialog');
        const text = document.getElementById('moderationErrorText');
        if (dialog && text) {
            text.innerText = errorMessage;
            dialog.showModal();
        }
    }

    /* ====================================================
       6. AI SUGGESTED MOOD AND TAG GENERATION
       ==================================================== */
    showMetadataForm() {
        const card = document.getElementById('metadataFormCard');
        const file = this.selectedFileBlob;
        if (!card || !file) return;

        card.removeAttribute('hidden');
        
        // Preset Title and Author fields
        const cleanName = file.name.replace('.pdf', '').replace(/[-_]/g, ' ');
        document.getElementById('bookTitle').value = DOMPurify.sanitize(cleanName);
        document.getElementById('bookAuthor').value = 'Unknown Scribe';

        // Trigger AI tag suggestions
        const suggestionText = document.getElementById('suggestedMoodText');
        const tagsContainer = document.getElementById('suggestedTagsContainer');

        suggestionText.innerText = "Analyzing title vocabulary...";
        tagsContainer.innerHTML = '';

        setTimeout(() => {
            const titleLower = cleanName.toLowerCase();
            let matchedMood = "Cozy Romance";
            let matchedAmbiance = "fireplace + piano + cafe";
            let tags = ["Warm", "Relaxing", "Soft Piano", "Cafe"];

            if (titleLower.includes('mystery') || titleLower.includes('dark') || titleLower.includes('gothic') || titleLower.includes('shadow')) {
                matchedMood = "Dark Gothic Mystery";
                matchedAmbiance = "rain + vinyl + violin";
                tags = ["Melancholic", "Rainy Night", "Spooky", "Vinyl"];
            } else if (titleLower.includes('poetry') || titleLower.includes('nature') || titleLower.includes('silent') || titleLower.includes('forest')) {
                matchedMood = "Cozy Nature Poetry";
                matchedAmbiance = "waves + fireplace + soft melodies";
                tags = ["Tranquil", "Reflection", "Ocean Waves", "Forest"];
            } else if (titleLower.includes('history') || titleLower.includes('timeless') || titleLower.includes('antique') || titleLower.includes('classic')) {
                matchedMood = "Timeless Antique Classic";
                matchedAmbiance = "vinyl + fireplace + old piano";
                tags = ["Vintage", "Cerebral", "Forgotten", "Aged Leather"];
            }

            suggestionText.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> <strong>${matchedMood}</strong> <br> Ambiance mix: <em>${matchedAmbiance}</em>`;
            
            // Pop suggested filter pills
            tags.forEach(tag => {
                const badge = document.createElement('span');
                badge.className = 'tag-suggested';
                badge.innerText = tag;
                badge.addEventListener('click', () => {
                    // Populate Form Field directly!
                    document.getElementById('bookMood').value = tag;
                    document.getElementById('bookTone').value = matchedMood;
                });
                tagsContainer.appendChild(badge);
            });

        }, 1200);

        card.scrollIntoView({ behavior: 'smooth' });
    }

    /* ====================================================
       7. SAVE TO INDEXEDDB & SHELF RENDERINGS
       ==================================================== */
    async saveBookToSanctuary() {
        const file = this.selectedFileBlob;
        if (!file) return;

        const title = document.getElementById('bookTitle').value;
        const author = document.getElementById('bookAuthor').value;
        const year = document.getElementById('bookYear').value || 'Unknown';
        const description = document.getElementById('bookDescription').value || '';
        const mood = document.getElementById('bookMood').value || 'Calm';
        const tone = document.getElementById('bookTone').value || 'Peaceful';
        const visibility = document.getElementById('bookVisibility').value;
        const coverFileInput = document.getElementById('bookCover');

        const bookId = `vault_${Date.now()}`;
        
        let coverUrl = '';
        if (coverFileInput.files.length) {
            // Store custom uploaded cover image as a dataURI
            const reader = new FileReader();
            coverUrl = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(coverFileInput.files[0]);
            });
        }

        // Store PDF as a raw binary Blob directly in IndexedDB!
        const pdfData = file;

        const bookData = {
            id: bookId,
            title,
            author,
            year,
            description,
            mood,
            tone,
            visibility,
            coverUrl,
            pdfData,
            addedAt: Date.now(),
            lastReadPage: 1,
            progress: 0,
            volumeMix: {}
        };

        try {
            await window.db.vault_books.put(bookData);
            
            // Reset Workspace UI
            document.getElementById('metadataFormCard').setAttribute('hidden', '');
            document.getElementById('uploadProgressContainer').setAttribute('hidden', '');
            document.getElementById('elaraScanner').setAttribute('hidden', '');
            document.getElementById('metadataForm').reset();
            this.selectedFileBlob = null;

            // Trigger bookshelf reload
            this.loadBookshelf();
            
            // If visibility is public, scroll down to alcove
            if (visibility === 'public') {
                document.getElementById('publicAlcove').scrollIntoView({ behavior: 'smooth' });
            } else {
                document.getElementById('bookshelfPrivate').scrollIntoView({ behavior: 'smooth' });
            }

        } catch (e) {
            console.error("Dexie insert failed", e);
            this.triggerElaraModeration("Database Error: Failed to write book archive. Please verify IndexedDB storage settings.");
        }
    }

    async loadBookshelf() {
        const privateContainer = document.getElementById('privateBooksContainer');
        const publicGrid = document.getElementById('publicBooksGrid');
        
        if (!privateContainer) return;

        // Fetch books from IndexedDB
        const allVaultBooks = await window.db.vault_books.toArray();
        
        // 1. Render Private Nook shelf
        const privateBooks = allVaultBooks.filter(b => b.visibility === 'private');
        privateContainer.innerHTML = '';

        if (privateBooks.length === 0) {
            privateContainer.innerHTML = '<p class="empty-shelf-text"><i class="fa-solid fa-feather"></i> Your nook is quiet. Drag a PDF to place your first story.</p>';
        } else {
            privateBooks.forEach((book, index) => {
                const bookSpine = document.createElement('div');
                bookSpine.className = 'shelf-book';
                
                // Randomly assign rich cover colors to simulate leather jackets
                const coverStyle = BOOKCASE_COVERS[index % BOOKCASE_COVERS.length];
                
                bookSpine.innerHTML = `
                    <div class="book-spine" style="background: ${coverStyle};">
                        <span class="book-spine-title">${DOMPurify.sanitize(book.title)}</span>
                        <span class="book-spine-author">${DOMPurify.sanitize(book.author)}</span>
                    </div>
                `;

                bookSpine.addEventListener('click', () => this.launchReadingSanctuary(book));
                privateContainer.appendChild(bookSpine);
            });
        }

        // 2. Render Public Alcove grid
        const publicBooks = allVaultBooks.filter(b => b.visibility === 'public');
        if (publicGrid) {
            publicGrid.innerHTML = '';
            if (publicBooks.length === 0) {
                publicGrid.innerHTML = `
                    <div class="no-public-books">
                      <i class="fa-solid fa-compass-drafting"></i>
                      <p>The alcove is currently quiet. Upload a story and set visibility to "Public Alcove" to share with others.</p>
                    </div>
                `;
            } else {
                publicBooks.forEach(book => {
                    const card = document.createElement('div');
                    card.className = 'cozy-shared-card';
                    
                    // Fallback to stylized base64 image or placeholder
                    const coverSrc = book.coverUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTk2IiB2aWV3Qm94PSIwIDAgMTI4IDE5NiI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzJjMjQyMCIvPjxyZWN0IHg9IjYiIHk9IjYiIHdpZHRoPSIxMTYiIGhlaWdodD0iMTg0IiBmaWxsPSJub25lIiBzdHJva2U9IiNkNGFmMzciIHN0cm9rZS13aWR0aD0iMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNDUlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iR2VvcmdpYSwgc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNmZmY1ZjUiIGZvbnQtc3R5bGU9Iml0YWxpYyI+QmlibGlvRHJpZnQ8L3RleHQ+PHRleHQgeD0iNTAlIiB5PSI2MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIxMCIgZmlsbD0iI2Q0YWYzNyI+UHVibGljIEFsY292ZTwvdGV4dD48L3N2Zz4=';
                    
                    card.innerHTML = `
                        <div class="shared-card-cover-wrapper">
                            <img src="${coverSrc}" alt="${DOMPurify.sanitize(book.title)} Cover" />
                        </div>
                        <div class="shared-card-info">
                            <h4>${DOMPurify.sanitize(book.title)}</h4>
                            <p class="author">By ${DOMPurify.sanitize(book.author)} (${DOMPurify.sanitize(book.year)})</p>
                            <p class="desc">${DOMPurify.sanitize(book.description)}</p>
                        </div>
                        <div class="shared-tags-row">
                            <span class="shared-tag"><i class="fa-solid fa-heart"></i> ${DOMPurify.sanitize(book.mood)}</span>
                            <span class="shared-tag"><i class="fa-solid fa-feather"></i> ${DOMPurify.sanitize(book.tone)}</span>
                        </div>
                        <div class="shared-card-footer">
                            <button class="shared-card-btn btn-read-public"><i class="fa-solid fa-book-open"></i> Read</button>
                            <div class="card-action-links">
                                <span class="shared-card-btn"><i class="fa-solid fa-bookmark"></i> Bookmark</span>
                            </div>
                        </div>
                    `;

                    card.querySelector('.btn-read-public').addEventListener('click', () => this.launchReadingSanctuary(book));
                    publicGrid.appendChild(card);
                });
            }
        }

        // 3. Set Continue Reading state
        const lastBook = allVaultBooks.sort((a,b) => b.addedAt - a.addedAt)[0];
        const continueCard = document.getElementById('continueReadingCard');
        if (lastBook && continueCard) {
            this.currentReadingBook = lastBook;
            document.getElementById('continueBookTitle').innerText = lastBook.title;
            document.getElementById('continueBookAuthor').innerText = `By ${lastBook.author}`;
            
            const pct = lastBook.progress || 0;
            document.getElementById('continueProgressFill').style.width = `${pct}%`;
            document.getElementById('continueProgressText').innerText = `Page ${lastBook.lastReadPage || 1} (${pct}%)`;
            continueCard.removeAttribute('hidden');
        } else if (continueCard) {
            continueCard.setAttribute('hidden', '');
        }
    }

    /* ====================================================
       8. COZY EMBEDDED PDF.JS READER INTEGRATION
       ==================================================== */
    async launchReadingSanctuary(book) {
        const dialog = document.getElementById('readerDialog');
        const loader = document.getElementById('pdfLoader');
        
        if (!dialog) return;

        this.currentReadingBook = book;
        this.currentReaderPageNum = book.lastReadPage || 1;
        this.isReaderRendering = false;

        document.getElementById('readerBookTitle').innerText = DOMPurify.sanitize(book.title);
        document.getElementById('readerBookAuthor').innerText = `By ${DOMPurify.sanitize(book.author)}`;
        
        // Show dialog modal
        dialog.showModal();
        loader.style.display = 'flex';

        // Load PDF from Dexie binary Blob
        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
            const typedarray = new Uint8Array(e.target.result);
            try {
                // Initialize PDFjs Document
                const loadingTask = pdfjsLib.getDocument(typedarray);
                this.pdfDocumentInstance = await loadingTask.promise;
                this.totalReaderPages = this.pdfDocumentInstance.numPages;
                
                // Clear loader and render current page
                loader.style.display = 'none';
                this.renderPDFPage(this.currentReaderPageNum);

            } catch (err) {
                console.error("PDFJS load failed", err);
                loader.innerHTML = '<p class="error-text"><i class="fa-solid fa-face-frown"></i> Failed to parse PDF page structures.</p>';
            }
        };
        fileReader.readAsArrayBuffer(book.pdfData);
    }

    async renderPDFPage(pageNum) {
        if (!this.pdfDocumentInstance || this.isReaderRendering) return;

        this.isReaderRendering = true;
        const canvas = document.getElementById('pdfRenderCanvas');
        const ctx = canvas.getContext('2d');

        try {
            const page = await this.pdfDocumentInstance.getPage(pageNum);
            
            // Maximize container scaling
            const viewport = page.getViewport({ scale: 1.5 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;
            this.isReaderRendering = false;

            // Update page indications
            document.getElementById('pageIndicatorText').innerText = `Page ${pageNum} of ${this.totalReaderPages}`;
            
            const pct = Math.round((pageNum / this.totalReaderPages) * 100);
            document.getElementById('readerProgressFill').style.width = `${pct}%`;

            // Persist reading progress indices
            this.saveReadingProgress(pageNum, pct);

        } catch (e) {
            console.error("Page render failed", e);
            this.isReaderRendering = false;
        }
    }

    async saveReadingProgress(pageNum, progressPct) {
        if (!this.currentReadingBook) return;
        
        try {
            await window.db.vault_books.update(this.currentReadingBook.id, {
                lastReadPage: pageNum,
                progress: progressPct
            });
            // Update local object
            this.currentReadingBook.lastReadPage = pageNum;
            this.currentReadingBook.progress = progressPct;

        } catch (e) {
            console.warn("Could not save progress", e);
        }
    }

    navigatePage(direction) {
        const next = this.currentReaderPageNum + direction;
        if (next >= 1 && next <= this.totalReaderPages) {
            this.currentReaderPageNum = next;
            this.renderPDFPage(next);
        }
    }

    closeReadingSanctuary() {
        const dialog = document.getElementById('readerDialog');
        if (dialog) {
            dialog.close();
            // Exit fullscreen if active
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            // Trigger shelf reload to update continue reading cards
            this.loadBookshelf();
        }
    }
}

// Initializer
document.addEventListener('DOMContentLoaded', () => {
    // Graceful startup loop
    function startup() {
        if (typeof Dexie === 'undefined' || typeof pdfjsLib === 'undefined') {
            setTimeout(startup, 50);
            return;
        }
        window.vaultSanctuary = new VaultSanctuary();
    }
    startup();
});
