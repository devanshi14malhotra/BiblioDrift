# 📘 API Request & Response Examples

This document provides sample request and response payloads for BiblioDrift APIs.

---

## 🔹 1. Chat Endpoint

**POST** `/api/v1/chat`

### Request

```json
{
  "message": "I want something cozy for a rainy evening"
}
```

### Response

```json
{
  "response": "You might enjoy 'The Night Circus' or 'Before the Coffee Gets Cold' for a cozy vibe."
}
```

---

## 🔹 2. Mood Search

**POST** `/api/v1/mood-search`

### Request

```json
{
  "query": "mystery thriller"
}
```

### Response

```json
{
  "results": [
    {
      "title": "Gone Girl",
      "author": "Gillian Flynn"
    },
    {
      "title": "The Girl with the Dragon Tattoo",
      "author": "Stieg Larsson"
    }
  ]
}
```

---

## 🔹 3. Analyze Mood

**POST** `/api/v1/analyze-mood`

### Request

```json
{
  "title": "The Great Gatsby",
  "author": "F. Scott Fitzgerald"
}
```

### Response

```json
{
  "mood": ["melancholic", "romantic", "tragic"]
}
```

---

## 🔹 4. Generate Notes

**POST** `/api/v1/generate-note`

### Request

```json
{
  "title": "Atomic Habits"
}
```

### Response

```json
{
  "summary": "A practical guide to building good habits and breaking bad ones."
}
```

---

## 🔹 5. Health Check

**GET** `/api/v1/health`

### Response

```json
{
  "status": "ok"
}
```
