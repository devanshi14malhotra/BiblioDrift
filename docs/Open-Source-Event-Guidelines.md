# BiblioDrift Contributor Guide for Open Source Events

This document is tailored for contributors participating in all open source events: _GirlsScript Summer of Code, Nexus Spring of Code, ACM Sourcery and Apertre3.0._

> [!IMPORTANT]
>
> ### Contribution & Assignment Guidelines
>
> * A maximum of **5 active issues** can be assigned to a contributor at a time.
> * Contributors may request more issues after completing their currently assigned issues and getting the corresponding PRs reviewed/merged.
> * Please work only on issues assigned to you.
> * To ensure fair participation, issue hoarding will not be encouraged.
> * If there is **no progress/update for 2–3 days**, the issue may be unassigned and opened for others to contribute.
> * Keep pull requests focused, meaningful, and easy to review.


[![BiblioDrift - Issues](https://img.shields.io/badge/BiblioDrift-Issues-9113ff?style=for-the-badge)](https://github.com/devanshi14malhotra/BiblioDrift/issues)

## 1. Project Overview

### Description
BiblioDrift is a Python-backed, visual-first book discovery project that turns reading exploration into a calm, shelf-based experience. It uses mood-driven discovery, 3D interactions, and AI-assisted notes to help users find their next read.

### Tech Stack
- Frontend/UI: HTML5, CSS3, Vanilla JavaScript
- Backend/API: Python Flask-style services
- Language: Python 3 and JavaScript
- Data Source: Google Books API
- AI Integration: AI-generated notes and recommendation flows
- Storage/State: LocalStorage and caching helpers for the MVP

### Current Features
- 3D shelf and virtual library interaction
- Mood-based book discovery and search flows
- Chat-style discovery interface
- AI-assisted recommendation and blurb generation
- Responsive layouts for desktop and mobile
- Validation, security, and cache helper modules

### Target Users
- Readers who want a calmer book discovery experience
- Open source contributors joining Sourcery by ACM IGDTUW
- Students and developers who enjoy creative web projects

---

## 2. Architecture and Key Modules

### Module Overview

| Module | Location | Purpose |
|---|---|---|
| Landing and app pages | `index.html`, `library.html`, `chat.html`, `auth.html`, `profile.html` | Main user-facing screens for discovery, chat, auth, and profile flows |
| Frontend behavior | `app.js`, `chat.js`, `library-3d.js`, `footer.js`, `script/header-scroll.js` | Interactions, shelf animations, chat UI, and shared page behavior |
| Styling | `style.css`, `style_main.css`, `style-responsive.css` | Core styling, layout polish, and responsive rules |
| Backend services | `app.py`, `ai_service.py`, `cache_service.py` | App entrypoint, AI logic, and cached state handling |
| Data and validation | `models.py`, `validators.py`, `error_responses.py`, `security_utils.py` | Data structures, input checks, errors, and safety helpers |
| Discovery services | `mood_analysis/`, `price_tracker/`, `purchase_links/` | Mood analysis, price tracking, and external link logic |
| Configuration | `config.py`, `config.js` | Shared configuration values |
| Assets | `assets/` | Images, sounds, and static media |

### High-Level Flow
1. A user opens the site and explores books through shelves, mood prompts, or chat.
2. Frontend scripts handle interactions and store local state where needed.
3. Backend services and AI helpers generate notes, recommendations, or supporting data.
4. The UI renders results in a calm, bookstore-like layout.

---

## 3. Feature Ideas for Sourcery Contributors

### Feature 1: Improve Mood Search
Problem it solves: Users should be able to search by vibe, emotion, or intent more reliably.

- Difficulty: Intermediate
- Estimated effort: 8-12 hours
- Suggested files:
  - `mood_analysis/mood_analyzer.py`
  - `app.js`
  - `ai_service.py`

### Feature 2: Strengthen Library Persistence
Problem it solves: Saved shelves should persist cleanly across refreshes and page transitions.

- Difficulty: Beginner to Intermediate
- Estimated effort: 4-8 hours
- Suggested files:
  - `library-3d.js`
  - `cache_service.py`
  - `app.js`

### Feature 3: Add Better Accessibility
Problem it solves: Keyboard and assistive-technology users need clearer interaction support.

- Difficulty: Intermediate
- Estimated effort: 6-10 hours
- Suggested files:
  - `index.html`, `library.html`, `chat.html`, `auth.html`
  - `style.css`
  - `app.js`

### Feature 4: Expand AI Book Notes
Problem it solves: Recommendation cards and chat replies can feel more useful with richer AI output.

- Difficulty: Intermediate to Advanced
- Estimated effort: 10-16 hours
- Suggested files:
  - `ai_service.py`
  - `chat.js`
  - `app.py`

### Feature 5: Improve Responsive Layout
Problem it solves: 3D and shelf UI should remain usable on tablets and phones.

- Difficulty: Intermediate
- Estimated effort: 6-12 hours
- Suggested files:
  - `style-responsive.css`
  - `library-3d.js`
  - `index.html`

### Feature 6: Add Safer Input Validation
Problem it solves: User input should be validated before it reaches AI or backend logic.

- Difficulty: Beginner to Intermediate
- Estimated effort: 4-8 hours
- Suggested files:
  - `validators.py`
  - `security_utils.py`
  - `app.py`

---

## 4. Implementation Pipeline (Recommended)

Follow this checklist for any feature PR during Sourcery.

1. Understand scope
- Pick one issue and confirm the expected result before coding.

2. Set up locally
- Read the README and CONTRIBUTING files.
- Open the app in a browser and verify the baseline behavior.

3. Implement small and focused changes
- Keep pull requests single-purpose.
- Reuse existing helpers where possible.

4. Validate with real flows
- Test at least 2 to 3 representative user journeys.
- Check behavior when content is missing or sparse.

5. Verify outputs
- Ensure UI updates still match the calm BiblioDrift style.
- Check readability on desktop and mobile views.

6. Submit polished PR
- Add before/after screenshots for visual changes.
- Mention files touched and testing done.

---

## 5. Good First Issues

### Issue 1: Improve Copy Text in UI
- Update wording for clarity and grammar.
- Files: `app.js`, `chat.js`, `auth.html`

### Issue 2: Add Empty-State Messaging
- Show a friendly message when a shelf or result list is empty.
- Files: `library.html`, `chat.html`, `app.js`

### Issue 3: Add One New Mood Flow
- Add a small mood category and wire it through the UI.
- Files: `mood_analysis/mood_analyzer.py`, `app.js`

### Issue 4: Improve Mobile Spacing
- Tighten layout spacing on smaller screens.
- Files: `style-responsive.css`, `style.css`, `library-3d.js`

### Issue 5: Document One API Flow Better
- Improve one example request/response path in the docs.
- Files: `README.md` or `docs/contributing.md`

---

#### 🎨 Apart from these, you’re encouraged to come up with your own ideas as well... You can raise new issues, get them assigned, and then submit PRs. Feel free to be creative, as this application is for you, and it’s a great opportunity to make your GitHub README truly reflect your personality...
#### You can also explore existing issues and pick up any that interest you...

---

## 6. Contributor Notes

### Prerequisites
- Python 3.9+ if you are running the backend
- Git

### Local Setup
```bash
git clone https://github.com/devanshi14malhotra/bibliodrift.git
cd BiblioDrift
```

### Contribution Rules
- Keep changes focused and easy to review.
- Do not break existing shelf, chat, or discovery behavior.
- Preserve the cozy visual identity of the project.
- Add concise docs for any new user-facing behavior.

### PR Checklist
- Branch was created from your fork or working branch.
- Code was tested locally.
- UI changes were checked in desktop and mobile views.
- Docs were updated if behavior changed.

### Need Help?
- Check the README.md and CONTRIBUTING.md files.
- Open an issue if something is unclear.
- Feel free to propose new ideas if they fit the project style.

---

## 7. Open Source Event Context

Currently, this repository is a part of the _**Nexus Spring of Code** Open Source Event_. This repository has participated in _**Sourcery** by ACM IGDTUW_ and _**Apertre3.0** by Resourcio Community_. Contributors are encouraged to start with beginner-friendly issues, then move into recommendation logic, mood flows, and UI refinements.


If you are new to the project, start with one of the Good First Issues above and open a draft PR early for feedback.

Happy building and all the best!!!

```bash
If you like this project, please consider giving the repository a ⭐ STAR ⭐.
```
