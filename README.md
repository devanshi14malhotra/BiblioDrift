<div align="center">

# 🌌 BiblioDrift — Drift Through Stories, Not Screens

[![Live App](https://img.shields.io/badge/🌍%20Live%20App-Explore%20Now-5314C4?style=for-the-badge&logo=netlify)](https://bibliodrift-dm.netlify.app/)
[![NSoC 2026](https://img.shields.io/badge/NSoC-2026-blue?style=for-the-badge)](docs/Open-Source-Event-Guidelines.md)
[![GSSoC 2026](https://img.shields.io/badge/GSSoC-2026-purple?style=for-the-badge)](docs/Open-Source-Event-Guidelines.md)
[![MIT License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

### 🌙 *A calm, immersive, AI-powered book discovery experience*

> **"Find yourself in the pages."**

<p align="center">
BiblioDrift transforms book discovery into an emotional journey —  
where stories are explored through <b>mood, atmosphere, and feeling</b> instead of endless scrolling.
</p>

<p align="center">
🌧️ Mood-first discovery • 📚 Immersive reading • 🤖 AI-powered storytelling
</p>


[🚀 Live Demo](https://bibliodrift-dm.netlify.app/) •
[📚 Documentation](docs/) •
[🤝 Contributing](docs/contributing.md)

</div>

---

## 🌌 Table of Contents

<div align="center">

| 📚 Section | 🔗 Description |
|---|---|
| 💭 **[The Idea](#-the-idea)** | Vision and inspiration behind BiblioDrift |
| 🧘 **[Core Philosophy](#-core-philosophy)** | Principles that shape the experience |
| ✨ **[Experience Highlights](#-experience-highlights)** | Main features and immersive interactions |
| 🛠️ **[Tech Stack](#-tech-stack)** | Technologies powering the platform |
| 🧠 **[System Architecture](#-system-architecture)** | Flow between frontend, backend, and AI |
| 📸 **[Screenshots](#-screenshots)** | Visual preview of the application |
| 📄 **[License](#-license)** | Project licensing information |

</div>


## 🌿 The Idea

Most platforms make reading feel like:
- ❌ Endless scrolling  
- ❌ Algorithm overload  
- ❌ No emotional connection  

**BiblioDrift is different.**

It feels like:
> 📚 Walking into a quiet bookstore  
> ☕ Picking a book based on mood  
> 🌧️ Letting the atmosphere guide you  

---

## 🌟 Core Philosophy

- 🧘 **Zero UI Noise** → No clutter, no distractions  
- 🎭 **Vibe-First Discovery** → Search by *feeling*, not metadata  
- 📖 **Tactile Interaction** → Books behave like real objects  
- 🤖 **AI as a Bookseller** → Not recommendations, but *conversations*  

---

## ✨ Experience Highlights

### 📚 Interactive Library
- 3D books you can **pull, flip, and explore**
- Shelf-based organization (Want / Reading / Favorites)

### 🧠 AI-Powered Discovery
- Mood-based recommendations (e.g., *“rainy mystery”*)
- Dynamic AI-generated blurbs
- Conversational assistant → **Elara, the Bookseller**

### 🌌 Immersive UX
- Glassmorphism interface
- Ambient sounds (rain, fireplace,Calm Ocean Waves,Stormy Rain)
- Emotion-based tagging system

### ⚡ Performance & UX
- Skeleton loaders (smooth loading)
- LocalStorage persistence
- Seamless interactions

---

## 🛠️ Tech Stack

| Layer | Technology |
|------|-----------|
| Frontend | HTML5, CSS3 (3D), Vanilla JS |
| API | Google Books API |
| Backend | Flask, SQLAlchemy, JWT cookies |
| AI | LLM-powered notes, chat, and mood analysis |
| Storage | LocalStorage |

---

## 🧠 System Architecture

```mermaid
graph TD
	A[Frontend UI] -->|Mood Query| B[Flask Backend]
	B -->|Prompt Engineering| C[LLM / AI Service]
	C -->|Generated Insight| B
	B -->|JSON Response| A
	A -->|Book Data| D[Google Books API]
	A -->|Persistence| E[LocalStorage]
```


## 📸 Screenshots

<div align="center">
	<h3>Discovery & Virtual Library</h3>
	<img src="https://github.com/user-attachments/assets/296b478b-f275-45c0-957b-50f6ee3a00c8" width="85%" alt="Home Page" />
	<br><br>
	<img src="https://github.com/user-attachments/assets/a1b9a827-d467-4d3c-a113-848252e13f68" width="47%" alt="Virtual Library" />
	<img src="https://github.com/user-attachments/assets/9434fa01-9634-46e3-a20b-15ada676a91c" width="47%" alt="Sign In Page" />
	<p><i>Capturing the tactile, vibe-first essence of BiblioDrift.</i></p>
</div>

---

## 📚 Documentation Hub

<div align="center">

| 📄 Document | ✨ Description |
|---|---|
| 🧠 **[Architecture Guide](docs/architecture.md)** | Detailed system design, data flow, and backend structure |
| 📡 **[API Documentation](docs/api.md)** | API endpoints, request/response examples, and integration flow |
| 🚀 **[Roadmap](docs/roadmap.md)** | Upcoming features and future development plans |
| 🗂️ **[Project Structure](docs/project-structure.md)** | Complete folder hierarchy and project organization |
| 📖 **[Tutorial Guide](docs/TUTORIAL.md)** | Step-by-step setup and usage walkthrough |
| 🤝 **[Contributing Guide](docs/contributing.md)** | Contribution workflow, rules, and PR process |
| 🧩 **[Mood Analysis Module](backend/mood_analysis/README.md)** | AI mood engine architecture and logic |
| 🛒 **[Purchase Links Module](backend/purchase_links/README.md)** | Purchase link generation system documentation |

</div>

---

<div align="center">

Built with ☕ and code by **Devanshi Malhotra** and contributors.

⭐ If you like this project, consider starring the repository.

</div>

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

