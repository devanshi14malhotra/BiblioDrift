/**
 * Community Stories Logic
 * Added by devanshi14malhotra
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const openFormBtn = document.getElementById('openFormBtn');
    const closeFormBtn = document.getElementById('closeFormBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const publishBtn = document.getElementById('publishBtn');
    const storyFormBackdrop = document.getElementById('storyFormBackdrop');
    
    const storyTitle = document.getElementById('storyTitle');
    const storyAuthor = document.getElementById('storyAuthor');
    const storyGenre = document.getElementById('storyGenre');
    const storyContent = document.getElementById('storyContent');
    const charCount = document.getElementById('charCount');
    
    const storiesGrid = document.getElementById('storiesGrid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    const storyReadBackdrop = document.getElementById('storyReadBackdrop');
    const closeReadBtn = document.getElementById('closeReadBtn');
    const readGenre = document.getElementById('readGenre');
    const readTitle = document.getElementById('readTitle');
    const readAuthor = document.getElementById('readAuthor');
    const readContent = document.getElementById('readContent');
    
    const toast = document.getElementById('toast');
    
    // Seed default stories if none exist
    const defaultStories = [
        {
            id: 1,
            title: "The Whispers of the Old Library",
            author: "Elara Vance",
            genre: "mystery",
            content: "The dust motes danced in the pale moonlight that filtered through the stained glass. I had been told the restricted section was locked, but the heavy oak door yielded with a soft creak. Inside, the books weren't just old; they felt alive. As I reached for a leather-bound tome on the top shelf, a whisper echoed through the silent aisles. 'You're not supposed to be here.' I turned around, but the corridor was completely empty. Only the faint smell of ozone and old parchment remained.",
            date: new Date().toLocaleDateString()
        },
        {
            id: 2,
            title: "Stardust and Tea Leaves",
            author: "Julian Moon",
            genre: "fantasy",
            content: "In the cafe at the edge of the universe, they serve tea brewed with actual stardust. It tastes like nostalgia and peppermint. I sat at my usual table by the viewing port, watching a nebula bloom in vibrant hues of purple and gold. The barista, an entity composed entirely of refracted light, slid my cup across the counter. 'Rough cycle?' it asked. I nodded, wrapping my hands around the warm ceramic. Here, at the end of everything, it was nice to just sit and drink tea.",
            date: new Date().toLocaleDateString()
        }
    ];

    let stories = JSON.parse(localStorage.getItem('bibliodrift_community_stories')) || defaultStories;

    // Save to local storage
    const saveStories = () => {
        localStorage.setItem('bibliodrift_community_stories', JSON.stringify(stories));
    };

    // Render Stories
    const renderStories = (filter = 'all') => {
        storiesGrid.innerHTML = '';
        
        const filteredStories = filter === 'all' 
            ? stories 
            : stories.filter(s => s.genre === filter);

        if (filteredStories.length === 0) {
            storiesGrid.innerHTML = `
                <div class="stories-empty">
                    <i class="fa-solid fa-book-open-reader"></i>
                    <p>No stories found in this genre yet. Be the first to write one!</p>
                </div>
            `;
            return;
        }

        // Sort by newest first (reverse order)
        [...filteredStories].reverse().forEach(story => {
            const card = document.createElement('div');
            card.className = 'story-card';
            card.innerHTML = `
                <div class="story-genre-badge">${story.genre}</div>
                <h3>${story.title}</h3>
                <div class="story-author-line">
                    <i class="fa-solid fa-pen-nib" style="font-size: 0.8rem;"></i>
                    ${story.author}
                </div>
                <div class="story-preview">${story.content}</div>
                <div class="story-meta">
                    <div class="story-date"><i class="fa-regular fa-clock"></i> ${story.date}</div>
                    <button class="story-read-btn">Read <i class="fa-solid fa-arrow-right-long"></i></button>
                </div>
            `;
            
            card.addEventListener('click', () => openReadModal(story));
            storiesGrid.appendChild(card);
        });
    };

    // Modal Logic
    const openFormModal = () => {
        storyFormBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeFormModal = () => {
        storyFormBackdrop.classList.remove('active');
        document.body.style.overflow = '';
        // Reset form
        storyTitle.value = '';
        storyAuthor.value = '';
        storyGenre.value = '';
        storyContent.value = '';
        charCount.textContent = '0';
    };

    const openReadModal = (story) => {
        readGenre.textContent = story.genre;
        readTitle.textContent = story.title;
        readAuthor.textContent = `by ${story.author}`;
        readContent.textContent = story.content;
        
        storyReadBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeReadModal = () => {
        storyReadBackdrop.classList.remove('active');
        document.body.style.overflow = '';
    };

    // Event Listeners
    openFormBtn?.addEventListener('click', openFormModal);
    closeFormBtn?.addEventListener('click', closeFormModal);
    cancelBtn?.addEventListener('click', closeFormModal);
    closeReadBtn?.addEventListener('click', closeReadModal);

    // Close on backdrop click
    storyFormBackdrop?.addEventListener('click', (e) => {
        if (e.target === storyFormBackdrop) closeFormModal();
    });
    storyReadBackdrop?.addEventListener('click', (e) => {
        if (e.target === storyReadBackdrop) closeReadModal();
    });

    // Character counter
    storyContent?.addEventListener('input', () => {
        charCount.textContent = storyContent.value.length;
    });

    // Publish Story
    publishBtn?.addEventListener('click', () => {
        const title = storyTitle.value.trim();
        const author = storyAuthor.value.trim();
        const genre = storyGenre.value;
        const content = storyContent.value.trim();

        if (!title || !author || !genre || !content) {
            alert('Please fill out all fields before publishing.');
            return;
        }

        const newStory = {
            id: Date.now(),
            title,
            author,
            genre,
            content,
            date: new Date().toLocaleDateString()
        };

        stories.push(newStory);
        saveStories();
        renderStories(document.querySelector('.filter-btn.active').dataset.genre);
        
        closeFormModal();
        
        // Show toast
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    });

    // Filter Logic
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderStories(btn.dataset.genre);
        });
    });

    // Initial render
    renderStories();
});
