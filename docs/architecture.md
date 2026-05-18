# System Architecture

> Frontend = Librarian  
> Backend = Curator  

```mermaid
graph TD
    A[Frontend UI] -->|Mood Query| B[Flask Backend]
    B -->|Prompt Engineering| C[LLM / AI Service]
    C -->|Generated Insight| B
    B -->|JSON Response| A
    A -->|Book Data| D[Google Books API]
    A -->|Persistence| E[LocalStorage]
```

This architecture demonstrates the separation of concerns:
- **Frontend UI:** Client-side mood queries and book interactions
- **Flask Backend:** Request handling, validation, and orchestration
- **LLM/AI Service:** Intelligent note and recommendation generation
- **Google Books API:** Book metadata and availability
- **LocalStorage:** Persistent client-side caching

See the API docs for endpoint details: [api.md](api.md)
