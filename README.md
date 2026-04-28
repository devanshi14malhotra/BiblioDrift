# BiblioDrift 📚☕
[![Netlify Live App - Click here to view!](https://img.shields.io/badge/Netlify-Live%20App-5314C4?logo=netlify)](https://gitcanvas-dm.streamlit.app/)

> **"Find yourself in the pages."**

BiblioDrift is a cozy, visual-first book discovery platform designed to make finding your next read feel like wandering through a warm, quiet bookstore rather than scrolling through a database.

## Open Source Events Navigation

[![Nexus Spring of Code- Contributor Guide](https://img.shields.io/badge/Nexus%20Spring%20Of%20Code-Contributor%20Guide-1D4ED8?style=for-the-badge)](Open-Source-Event-Guidelines.md)

## 🌟 Core Philosophy
- **"Zero UI Noise"**: No popups, no aggressive metrics. Just calm browsing.
- **Tactile Interaction**: 3D books that you can pull from the shelf and flip over.
- **Vibe-First**: Search for feelings ("rainy mystery"), not just keywords.

## 🚀 Features (MVP & Roadmap)
- **Interactive 3D Books**: Hover to pull, click to flip and **expand**.
- **Virtual Library**: Realistic wooden shelves to save your "Want to Read", "Currently Reading", and "Favorites" list (Persistent via LocalStorage).
- **Glassmorphism UI**: A soothing, modern interface that floats above the content.
- **AI-Powered Recommendations** (Planned): All book recommendations must be generated exclusively by AI.  
     No manual curation, static lists, or hardcoded recommendations are permitted.
- **Dynamic Popups**: Click a book to see an expanded view with AI-generated blurbs.
- **Curated Tables**: Horizontal scrolling lists based on moods like "Monsoon Reads".
- **Elara, the Wise Bookseller**: An interactive AI persona who chats with you, remembers your mood, and hand-picks books like a real librarian.
- **Ambient Sanctuary**: Immersive background sounds (e.g., Rainy Evening, Cozy Fireplace) with volume control to enhance your reading atmosphere.
- **Emotion-Based Tagging**: Personalize your library by tagging books with feelings like *Cozy*, *Melancholic*, or *Adventurous*.
- **Mood Discovery**: Sort and filter your entire collection by emotional resonance and vibes.

## 🛠️ Tech Stack

<div align="center">
<table style="border: none; border-collapse: collapse;">
<tr>
<td align="center"><b>Frontend</b>


<code>Vanilla JS</code> • <code>CSS3 3D</code> • <code>HTML5</code></td>
<td align="center"><b>API & Data</b>


<code>Google Books API</code> • <code>LocalStorage</code></td>
<td align="center"><b>Backend & AI</b>


<code>Python Flask</code> • <code>FAISS / LLM</code></td>
</tr>
</table>
</div>

## System Architecture
To maintain our strict AI-driven model, BiblioDrift utilizes a decoupled flow where the backend acts as the "Curator" and the frontend acts as the "Librarian."
```mermaid
graph TD
    A[Vanilla JS Frontend] -->|Vibe Query| B[Flask Backend]
    B -->|Prompt Engineering| C[AI Service / LLM]
    C -->|Generated Blurb| B
    B -->|JSON Response| A
    A -->|Book Details| D[Google Books API]
    A -->|Persistence| E[LocalStorage]
    A -->|Emotion Tags| E

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#000,stroke:#fff,stroke-width:2px,color:#fff
```

## 🤖 Project Structure 
```
BIBLIODRIFT/
BIBLIODRIFT/
│
├── backend/                     #  Python backend logic
│   ├── app.py
│   ├── ai_service.py
│   ├── cache_service.py
│   ├── config.py
│   ├── error_responses.py
│   ├── models.py
│   ├── security_utils.py
│   ├── validators.py
│   │
│   ├── mood_analysis/          # mood-based recommendation logic
│   └── purchase_links/         # purchase link generation
|   ├── price_tracker/   
│
├── frontend/                   #  UI (client-side)
│   ├── pages/                  # HTML files
│   │   ├── index.html
│   │   ├── auth.html
│   │   ├── chat.html
│   │   ├── library.html
│   │   ├── profile.html
│   │   └── 404.html
│   │
│   ├── js/                     # JavaScript
│   │   ├── app.js
│   │   ├── chat.js
│   │   ├── config.js
│   │   ├── footer.js
│   │   └── library-3d.js
│   │
│   ├── css/                    # Styles
│   │   ├── style.css
│   │   ├── style_main.css
│   │   └── style-responsive.css
│   │
│   ├── assets/                 # Images, sounds
│   │   ├── images/
│   │   └── sounds/
│   │
│   └── script/                 # extra JS (header scroll etc.)
│
├── config/                     # ⚙️ Configuration
│   ├── .env.development
│   ├── .env.example
│   ├── .env.testing
│   ├── requirements.txt
│   └── runtime.txt
│
├── docs/                       # 📚 Documentation
│   ├── contributing.md
│   ├── Open-Source-Event-Guidelines.md
│   ├── TUTORIAL.md
│   └── page.png
│
├── tests/                      # 🧪 Test files
│   ├── test_api.py
│   ├── test_llm.py
│   └── test_validation.py
│
├── .gitignore
├── README.md
├── LICENSE
├── netlify/                    # deployment config
├── script/ (if any left)       
├── venv/                       
└── .vscode/
```
## 🤖 AI Recommendation Policy

BiblioDrift follows a **strict AI-only recommendation model**.

- All recommendations must be generated dynamically using AI/LLMs.
- Manual curation, editor picks, static mood lists, or hardcoded book mappings are **not allowed**.
- AI outputs should be based on abstract signals such as:
  - Vibes
  - Mood descriptors
  - Emotional tone
  - Reader intent

This ensures discovery stays organic, scalable, and aligned with BiblioDrift’s philosophy of vibe-first exploration.

## 📦 Installation & Setup

### Frontend (Current MVP)
1. Clone the repository:
   ```bash
   git clone https://github.com/devanshi14malhotra/bibliodrift.git
   ```
2. Open `index.html` in your browser.
   - That's it! No build steps required for the vanilla frontend.

### Backend (Future)
Planned implementation using Python Flask.

## 🚢 Deployment Notes

- Netlify should serve the static frontend from the generated `dist/` bundle.
- The Flask backend, database, Redis, and AI services are not hosted by Netlify.
- To make the API work in production, deploy the backend separately and point the frontend `MOOD_API_BASE` to that host.

##  Screenshots

<div align="center">
  <h3>Discovery & Virtual Library</h3>
  <img src="https://github.com/user-attachments/assets/296b478b-f275-45c0-957b-50f6ee3a00c8" width="85%" alt="Home Page" />
  <br><br>
  <img src="https://github.com/user-attachments/assets/a1b9a827-d467-4d3c-a113-848252e13f68" width="47%" alt="Virtual Library" />
  <img src="https://github.com/user-attachments/assets/9434fa01-9634-46e3-a20b-15ada676a91c" width="47%" alt="Sign In Page" />
  <p><i>Capturing the tactile, vibe-first essence of BiblioDrift.</i></p>
</div>

## 🧠 AI Service Integration
To keep the frontend and backend synced, use the following mapping:

| Feature | Frontend Call (`app.js`) | API Endpoint (`app.py`) | Logic Provider (`ai_service.py`) |
| :--- | :--- | :--- | :--- |
| **Book Vibe** | `POST /api/v1/generate-note` | `handle_generate_note()` | `generate_book_note()` |

### API Integration
- **Endpoint**: `POST /api/v1/generate-note`
- **Logic**: Processed by `ai_service.py`

## 📡 API Request & Response Examples

### Endpoint: Generate Book Note

**Method:** POST
**URL:** `/api/v1/generate-note`
**Description:** Generates an AI-powered "bookseller note" based on the book's vibe, mood, and metadata.

---

### Request

**Headers**

```json
{
  "Content-Type": "application/json"
}
```

**Body**

```json
{
  "title": "The Night Circus",
  "author": "Erin Morgenstern",
  "mood": "mysterious, magical, slow-burn romance"
}
```

---

### Response

**Success (200 OK)**

```json
{
  "status": "success",
  "note": "A dreamlike duel unfolds in a wandering circus of shadows and light. Perfect for readers who crave atmospheric magic and quiet intensity."
}
```

**Error (400 Bad Request)**

```json
{
  "status": "error",
  "message": "Missing required fields: title or mood"
}
```

---

### API Flow Explanation

1. Frontend sends a POST request from `app.js` to `/api/v1/generate-note`.
2. The Flask backend (`app.py`) receives the request via `handle_generate_note()`.
3. Input data (title, author, mood) is validated.
4. The request is passed to `generate_book_note()` in `ai_service.py`.
5. The AI model generates a contextual "bookseller note".
6. The backend returns the generated note as a JSON response.
7. Frontend displays the note in the book popup UI.


## 🤝 Contributing
We welcome contributions to make BiblioDrift cozier!

1. Fork the repo.
2. Create a feature branch such as `feature/cozy-mode`.
3. Make your changes and test them locally.
4. Push your branch and open a Pull Request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the fuller workflow and contribution rules.

## 📄 License
MIT License.

---
*Built by Devanshi Malhotra and contributors, with ☕ and code.*


```bash
If you like this project, please consider giving the repository a ⭐ STAR ⭐.
```
