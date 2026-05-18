# Project Structure

```text
BIBLIODRIFT/
│
├── backend/                     #  Python backend logic
│   ├── app.py                   # Flask application entry point
│   ├── ai_service.py            # LLM integration and prompts
│   ├── cache_service.py         # Caching layer
│   ├── config.py                # Configuration management
│   ├── error_responses.py       # Standardized error handling
│   ├── models.py                # Database models (SQLAlchemy)
│   ├── security_utils.py        # Authentication and authorization
│   ├── validators.py            # Input validation
│   │
│   ├── mood_analysis/           # Mood-based recommendation logic
│   │   ├── __init__.py
│   │   ├── mood_analyzer.py
│   │   ├── mood_cache.json
│   │   ├── mood_query_parser.py
│   │   ├── ai_service_enhanced.py
│   │   ├── goodreads_scraper.py
│   │   └── README.md
│   │
│   ├── purchase_links/          # Purchase link generation
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── link_generators.py
│   │   ├── purchase_manager.py
│   │   ├── purchase_service.py
│   │   └── README.md
│   │
│   ├── price_tracker/           # Price tracking functionality
│   │   ├── __init__.py
│   │   └── price_tracker.py
│   │
│   └── migrations/              # Database migrations (Alembic)
│       ├── alembic.ini
│       ├── env.py
│       └── versions/
│
├── frontend/                    #  UI (client-side)
│   ├── pages/                   # HTML files
│   │   ├── index.html           # Home page
│   │   ├── auth.html            # Authentication
│   │   ├── chat.html            # Chat with Elara
│   │   ├── library.html         # Virtual library
│   │   ├── profile.html         # User profile
│   │   └── 404.html             # Error page
│   │
│   ├── js/                      # JavaScript modules
│   │   ├── app.js               # Main application logic
│   │   ├── chat.js              # Chat functionality
│   │   ├── config.js            # Frontend config
│   │   ├── footer.js            # Footer component
│   │   ├── library-3d.js        # 3D library rendering
│   │   ├── ambient.js           # Ambient sounds
│   │   ├── security.js          # Client-side security
│   │   ├── pwa.js               # PWA features
│   │   └── book-preview.js      # Book preview modal
│   │
│   ├── css/                     # Stylesheets
│   │   ├── style.css            # Main styles
│   │   ├── style_main.css       # Component styles
│   │   ├── style-responsive.css # Responsive design
│   │   └── keyboard-shortcuts.css # Shortcut hints
│   │
│   ├── assets/                  # Static assets
│   │   ├── images/              # Images and icons
│   │   └── sounds/              # Ambient sounds
│   │
│   ├── scratch/                 # Development utilities
│   └── script/                  # Extra utility scripts
│
├── config/                      # ⚙️ Configuration
│   ├── requirements.txt         # Python dependencies
│   ├── runtime.txt              # Runtime configuration
│   ├── .env.development         # Dev environment variables
│   ├── .env.example             # Template for env vars
│   └── .env.testing             # Test environment variables
│
├── docs/                        # 📚 Documentation
│   ├── contributing.md          # Contribution guidelines
│   ├── Open-Source-Event-Guidelines.md
│   ├── TUTORIAL.md              # Setup tutorial
│   ├── MIGRATIONS.md            # Database migration guide
│   └── page.png                 # Documentation assets
│
├── tests/                       # 🧪 Test files
│   ├── test_api.py              # API endpoint tests
│   ├── test_llm.py              # LLM service tests
│   ├── test_mood_improvements.py
│   ├── test_security.py         # Security tests
│   ├── test_validation.py       # Validator tests
│   └── test_env_validation.py   # Environment tests
│
├── netlify/                     # 🚀 Netlify deployment
│   └── functions/
│       └── app.py               # Serverless backend
│
├── migrations/                  # Database migrations
│   ├── alembic.ini
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│
├── .gitignore
├── README.md                    # Main documentation
├── LICENSE                      # MIT License
├── Dockerfile                   # Docker container
├── docker-compose.yml           # Docker compose setup
├── netlify.toml                 # Netlify config
├── CODEOFCONDUCT.md            # Community guidelines
├── API_EXAMPLES.md             # API usage examples
└── venv/                        # Virtual environment
```

---

## Key Directories

- **backend/**: Core Flask application and microservices
- **frontend/**: Vanilla JS and HTML5 single-page application
- **docs/**: Comprehensive documentation and guides
- **tests/**: Automated test suites
- **config/**: Environment and dependency configuration
