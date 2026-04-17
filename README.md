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

## 🛠️ Tech Stack
- **Frontend**: Vanilla JavaScript, CSS3 (3D Transforms), HTML5
- **API**: Google Books API (Real-time data)
- **Storage**: LocalStorage (MVP), PostgreSQL (Planned)
- **Backend (Planned)**: Python Flask
- **AI (Planned)**: LLM integration for "Bookseller Notes"

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

### Home Page
<img width="1912" height="921" alt="Screenshot 2026-02-09 212125" src="https://github.com/user-attachments/assets/296b478b-f275-45c0-957b-50f6ee3a00c8" />

### Virtual Library
<img width="1912" height="922" alt="Screenshot 2026-02-09 212207" src="https://github.com/user-attachments/assets/a1b9a827-d467-4d3c-a113-848252e13f68" />

### Sign In Page
<img width="1917" height="916" alt="Screenshot 2026-02-09 212225" src="https://github.com/user-attachments/assets/9434fa01-9634-46e3-a20b-15ada676a91c" />


## 🧠 AI Service Integration
To keep the frontend and backend synced, use the following mapping:

| Feature | Frontend Call (`app.js`) | API Endpoint (`app.py`) | Logic Provider (`ai_service.py`) |
| :--- | :--- | :--- | :--- |
| **Book Vibe** | `POST /api/v1/generate-note` | `handle_generate_note()` | `generate_book_note()` |

### API Integration
- **Endpoint**: `POST /api/v1/generate-note`
- **Logic**: Processed by `ai_service.py`

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
