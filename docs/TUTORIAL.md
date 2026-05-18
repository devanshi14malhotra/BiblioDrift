# BiblioDrift Tutorial 📚☕

Welcome to BiblioDrift! This comprehensive tutorial will guide you through discovering your next great read in our cozy, visual-first book discovery platform.

## What is BiblioDrift?

BiblioDrift is more than just a book finder—it's a sanctuary for readers who discover books through emotions and vibes rather than rigid categories. Imagine wandering through a warm, quiet bookstore where books practically whisper their stories to you.


## Why BiblioDrift is Different

Unlike traditional platforms that focus heavily on categories and algorithms, BiblioDrift emphasizes:

🎨 Visual-first discovery – Explore beautiful book covers and curated collections

💫 Emotion-based browsing – Find books by how you feel, not just by genre

📖 Curated recommendations – Thoughtfully selected reads instead of endless scrolling

🧘 Calm, cozy experience – A distraction-free space designed for mindful browsing

It’s not about finding the most popular book.
It’s about finding the right book for you.


### Core Philosophy
- **"Zero UI Noise"**: Clean, distraction-free browsing experience
- **Tactile Interaction**: 3D books you can pull from shelves and flip over
- **Vibe-First Discovery**: Search for feelings like "rainy mystery" or "cozy adventure"

---

## 🚀 Getting Started

### Quick Start (Frontend Only)
BiblioDrift works right out of the box! No complex setup required.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/devanshi14malhotra/bibliodrift.git
   cd bibliodrift
   ```

2. **Open in browser:**
   - Simply open `index.html` in your web browser
   - That's it! Start exploring books immediately

### Optional: Backend Setup (For AI Features)
If you want to enable AI-powered book notes and recommendations:

1. **Install Python dependencies:**
   ```bash
   pip install flask flask-cors
   ```

2. **Start the backend server:**
   ```bash
   python app.py
   ```
   The server will run on `http://localhost:5000`

3. **Update the frontend:**
   - Modify `app.js` to point to your local API instead of placeholder vibes

---

## 📖 Using BiblioDrift

### The Discovery Page

When you first open BiblioDrift, you'll land on the **Discovery** page with three curated sections:

#### 1. Rainy Evening Reads 🌧️
- **Theme**: Mystery & Melancholy
- **Perfect for**: Cozy indoor days, reflective moods
- Features books with atmospheric, introspective vibes

#### 2. Indian Authors 🪶
- **Theme**: Voices from the Subcontinent
- **Highlights**: Works by Indian authors and stories set in India
- Showcases diverse perspectives and cultural narratives

#### 3. Forgotten Classics ⌛
- **Theme**: Timeless & Dust-free
- **Features**: Enduring literary works that deserve rediscovery
- Curated classics that have stood the test of time

### Interactive Book Features

Each book in BiblioDrift is a 3D interactive element:

#### Hover to Preview
- **Action**: Move your mouse over any book
- **Effect**: The book gently pulls forward from the shelf
- **Purpose**: Get a quick glimpse without committing to a full view

#### Click to Expand
- **Action**: Click on any book
- **Effect**: Book flips open to reveal detailed information
- **What you'll see**:
    - **Smooth Shimmer Loading**: You'll see modern skeleton loaders while the AI fetches specialized book insights.
    - **AI-Generated Blurbs**: Personalized summaries generated specifically for your mood.
    - **Interactive Back Cover**: Click the "Flip" instruction to see the physical back of the book with its synopsis.
    - **Library Management**: Use the compact action buttons to move books between shelves or share them with friends.
  - Full synopsis and AI-generated vibe notes
  - User reviews and ratings
  - **Emotion Tagging**: A new section where you can mark how a book makes you feel (e.g., *Cozy*, *Tense*, *Whimsical*).

---

## 🎨 Emotion-Based Discovery

BiblioDrift’s standout feature is its ability to organize your library by feelings.

### Tagging Your Books
1. Open your **My Library** page.
2. Click on any book to open its detail modal.
3. Locate the **"How does this book make you feel?"** section.
4. Toggle different emotions. These are saved instantly to your profile!

### Filtering & Sorting by Mood
Once you’ve tagged your collection, you can find the perfect book for your current mood:
- **Search by Feeling**: Type a mood like "Cozy" into the search bar at the top of the library. Only books matching that vibe will remain on the shelves.
- **Sort by Mood**: Select "Sort by Mood" from the sorting dropdown. Your library will reorganize itself, grouping similar emotional journeys together.
- **Visual Cues**: Look at the spines of your 3D books! Small icons will appear on books you've tagged, giving you a quick visual guide to your library's emotional landscape.

---

## 🏘️ Managing Your Library

#### Book Actions
Once a book is flipped open, you'll see two action buttons:

- **❤️ Add to Library**: Save the book to your personal virtual library
- **↻ Flip Back**: Return the book to its shelf position

### Searching for Books

BiblioDrift's search is designed for emotional discovery:

#### How to Search
1. **Click in the search bar** at the top of the page
2. **Type your feeling or vibe** (not just keywords!)
3. **Press Enter**

#### Search Examples
Try these emotional searches:
- `"rainy afternoon mystery"`
- `"cozy winter evening"`
- `"adventurous escape"`
- `"thoughtful contemplation"`
- `"heartwarming family"`

#### Search Results
- Results appear in a clean, focused layout
- Each book maintains the same interactive 3D features
- Bookseller notes provide personalized recommendations

---

## 📚 My Virtual Library

Your personal book sanctuary, organized like a real bookshelf.

### Accessing Your Library
- Click **"My Library"** in the navigation bar
- Or visit `library.html` directly

### The Three Shelves

#### 1. Currently Immersed 📖
- **Purpose**: Books you're actively reading
- **Empty state**: "Your nightstand is empty..."
- **Use when**: You've started a book and want to track your progress

#### 2. Anticipated Journeys 📚
- **Purpose**: Books you want to read in the future
- **Also known as**: "Want to Read" or "TBR" (To Be Read)
- **Use when**: You find interesting books but aren't ready to start them yet

#### 3. Lifetime Favorites ✓
- **Purpose**: Books that have become special to you
- **Use when**: You've finished a book and want to remember it forever

### Managing Your Library

#### Adding Books
1. **Find a book** on the Discovery page or through search
2. **Click the book** to flip it open
3. **Click the heart icon (❤️)** to add to library
4. **Choose your shelf** from the popup menu:
   - "Currently Reading"
   - "Want to Read"
   - "Finished/Favorites"

#### Viewing Your Books
- Books appear as 3D elements on their respective shelves
- Each book shows its cover and maintains interactive features
- Click any book to see details and move between shelves

#### Organizing Your Collection
- Books are saved locally in your browser
- Your library persists between sessions
- No account required—your data stays private on your device

---

## 🎨 User Interface Features

### Ambient Sanctuary
- **Location**: Leaf icon floating on the right side of the screen
- **Function**: Toggle immersive background sounds (Rainy Evening or Cozy Fireplace)
- **Features**: Independent volume control to perfect your reading atmosphere

### Theme Toggle
- **Location**: Moon icon in the top-right corner
- **Function**: Switch between light and dark themes
- **Persistence**: Your theme preference is remembered

### Navigation
- **Discovery**: Browse curated books and search
- **My Library**: Access your personal book collection
- **Sign In**: Authentication (planned feature)

### Responsive Design
- BiblioDrift works beautifully on:
  - Desktop computers
  - Tablets
  - Mobile phones
- The 3D book interactions adapt to touch devices

### Back to Top
- **When**: Scroll down the page
- **Where**: Arrow button appears in bottom-right corner
- **Action**: Smooth scroll back to the top of the page

---

## 🔧 Advanced Features

### AI-Powered Recommendations (Planned)
BiblioDrift follows a strict AI-only recommendation policy:
- All book suggestions are generated by AI
- No manual curation or static lists
- Recommendations based on emotional and atmospheric cues

### API Integration
The app uses the Google Books API for real-time book data:
- Millions of books available
- Up-to-date information
- High-quality cover images

### Local Storage
Your library is saved locally:
- No internet connection required for saved books
- Privacy-focused (data stays on your device)
- Automatic backup and restore

---

## 🐛 Troubleshooting

### Books Not Loading
- **Cause**: Google Books API connection issue
- **Solution**: Check your internet connection and refresh the page
- **Fallback**: Books will show placeholder covers if images fail to load

### Search Not Working
- **Cause**: Empty search query or API timeout
- **Solution**: Try different search terms or refresh the page
- **Tip**: Use emotional/vibe-based searches for best results

### Library Not Saving
- **Cause**: Browser storage disabled or full
- **Solution**: Enable local storage in browser settings
- **Alternative**: Try a different browser

### 3D Effects Not Working
- **Cause**: Older browser or hardware acceleration disabled
- **Solution**: Update your browser or enable hardware acceleration
- **Fallback**: Books still display correctly, just without 3D effects

---

## 🎯 Tips for Book Discovery

### Vibe-Based Searching
Instead of searching "thriller," try:
- `"tense psychological mystery"`
- `"heart-pounding suspense"`
- `"noir detective story"`

### Emotional Exploration
- **Rainy days**: Search for "atmospheric melancholy"
- **Travel**: Try "adventurous journey"
- **Comfort**: Look for "heartwarming cozy"

### Building Your Library
- Start with 2-3 books per shelf to avoid overwhelm
- Use "Currently Reading" for active engagement
- Move books between shelves as your relationship with them evolves

### Curated Sections
- **Rainy Evening Reads**: Perfect for introspection
- **Indian Authors**: Discover diverse voices
- **Forgotten Classics**: Timeless literary experiences

---

## 🚀 What's Next

BiblioDrift is continuously evolving. Planned features include:

- **AI Bookseller Notes**: Personalized recommendations for every book
- **Reading Progress Tracking**: Mark chapters, add notes
- **Social Features**: Share discoveries with friends
- **Advanced Search**: Filter by mood, length, complexity
- **Reading Lists**: Create custom themed collections

---

## 📞 Support & Community

- **Issues**: Report bugs on GitHub
- **Features**: Suggest improvements via GitHub Issues
- **Contributing**: See CONTRIBUTING.md for guidelines

---

*Happy reading! May you find yourself in the pages. 📖✨*