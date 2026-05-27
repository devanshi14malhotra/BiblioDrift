# BiblioDrift GoodReads Mood Analysis Feature

## Overview

This feature enhances BiblioDrift's AI-first book discovery by analyzing GoodReads reviews to determine book "mood" and emotional tone. It provides users with deeper insights into books through sentiment analysis and mood categorization.

## Features

### 🎭 Mood Detection
- **Sentiment Analysis**: Uses VADER and TextBlob to analyze review sentiment
- **Mood Categories**: Detects 10 distinct moods:
  - `cozy` - Warm, comforting reads
  - `dark` - Grim, disturbing themes  
  - `mysterious` - Suspenseful, intriguing plots
  - `romantic` - Love stories and relationships
  - `adventurous` - Action-packed journeys
  - `melancholy` - Bittersweet, nostalgic tones
  - `uplifting` - Inspiring, hopeful narratives
  - `intense` - Emotionally powerful stories
  - `whimsical` - Quirky, charming tales
  - `thought-provoking` - Deep, philosophical works

### 📊 Visual Mood Indicators
- **Mood Tags**: Color-coded tags on book covers
- **Sentiment Bars**: Visual representation of overall sentiment
- **Detailed Analysis Modal**: In-depth mood breakdown with statistics

### 🤖 AI-Enhanced Vibes
- **Smart Vibe Generation**: Combines GoodReads analysis with fallback AI
- **BiblioDrift-Style Descriptions**: Generates cozy, bookstore-like recommendations
- **Caching System**: Stores analyses to avoid re-scraping

## Technical Architecture

### Backend Components

#### 1. GoodReads Scraper (`goodreads_scraper.py`)
```python
class GoodReadsReviewScraper:
    - search_book_by_title()    # Find books on GoodReads
    - scrape_reviews()          # Extract review text and ratings
    - get_book_reviews()        # Complete workflow
```

#### 2. Mood Analyzer (`mood_analyzer.py`)
```python
class BookMoodAnalyzer:
    - analyze_sentiment()       # VADER + TextBlob analysis
    - extract_mood_keywords()   # Keyword-based mood detection
    - determine_primary_mood()  # Overall mood determination
    - generate_bibliodrift_vibe() # Custom vibe generation
```

#### 3. Enhanced AI Service (`ai_service.py`)
```python
class AIBookService:
    - analyze_book_mood()       # Complete mood analysis
    - _load_cache() / _save_cache() # Caching system
```

#### 4. Flask API Endpoints (`app.py`)
- `GET /` - API documentation and endpoint list (visit in browser)
- `GET /api/v1/health` - Health check
- `POST /api/v1/analyze-mood` - Full mood analysis (**POST only**)
- `POST /api/v1/mood-tags` - Quick mood tags (**POST only**)
- `POST /api/v1/generate-note` - Enhanced note generation (**POST only**)
- `POST /api/v1/chat` - Chat with bookseller (**POST only**)

**Note**: POST-only endpoints will return 405 Method Not Allowed when accessed via browser GET requests. This is expected behavior.

### Frontend Integration

#### Enhanced Book Renderer (`app.js`)
- **Async Mood Loading**: Fetches mood data for each book
- **Visual Mood Tags**: Displays mood indicators on covers
- **Interactive Modal**: Detailed mood analysis popup
- **Fallback System**: Graceful degradation when API unavailable

#### CSS Styling (`style.css`)
- **Mood-Specific Colors**: Color-coded mood categories
- **Responsive Modal**: Mobile-friendly mood analysis display
- **Smooth Animations**: Polished user interactions

## Installation & Setup

### 1. Install Dependencies
```bash
# Using the setup script (recommended)
python setup_mood_analysis.py

# Or manually
pip install -r requirements.txt
```

### 2. Start the Backend Server
```bash
python app.py
```
Server runs on `http://localhost:5000`

**Important for Developers**: 
- Visit `http://localhost:5000/` in your browser to see available API endpoints and usage examples
- **All mood analysis endpoints are POST-only** - visiting them in browser will return 405 Method Not Allowed (this is expected)
- Use curl, Postman, or the frontend JavaScript to test the APIs

### 3. Open Frontend
Open `index.html` in your browser. The frontend will automatically connect to the backend for mood analysis.

## Usage

### For Users
1. **Browse Books**: Mood tags appear automatically on book covers
2. **View Details**: Click books to see AI-generated vibes enhanced with mood data
3. **Analyze Mood**: Click the brain icon for detailed mood analysis
4. **Search by Mood**: Use emotional search terms like "cozy mystery" or "uplifting romance"

### For Developers

#### API Usage Examples

**Important**: All endpoints except `/` and `/api/v1/health` require POST requests with JSON body.

**Analyze Book Mood:**
```bash
# Using curl (recommended for testing)
curl -X POST http://localhost:5000/api/v1/analyze-mood \
  -H "Content-Type: application/json" \
  -d '{"title": "The Seven Husbands of Evelyn Hugo", "author": "Taylor Jenkins Reid"}'

# Using JavaScript (frontend integration)
const response = await fetch('http://localhost:5000/api/v1/analyze-mood', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        title: "The Seven Husbands of Evelyn Hugo",
        author: "Taylor Jenkins Reid"
    })
});
const data = await response.json();
```

**Get Quick Mood Tags:**
```bash
# Using curl
curl -X POST http://localhost:5000/api/v1/mood-tags \
  -H "Content-Type: application/json" \
  -d '{"title": "Where the Crawdads Sing", "author": "Delia Owens"}'

# Using JavaScript
const response = await fetch('http://localhost:5000/api/v1/mood-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        title: "Where the Crawdads Sing",
        author: "Delia Owens"
    })
});
```

## Testing

### Run Test Suite
```bash
python test_mood_analysis.py
```

### Manual Testing
1. **Backend**: Use curl or Postman to test API endpoints
2. **Frontend**: Open browser developer tools to monitor API calls
3. **Integration**: Test complete workflow from book search to mood display

## Performance Considerations

### Caching Strategy
- **Local Cache**: Mood analyses cached in `mood_cache.json`
- **Cache Keys**: Based on `title|author` combination
- **Persistence**: Survives server restarts

### Rate Limiting
- **Respectful Scraping**: 1-3 second delays between requests
- **Limited Reviews**: Maximum 15-20 reviews per book
- **Error Handling**: Graceful fallbacks when scraping fails

### Fallback System
1. **Primary**: GoodReads mood analysis
2. **Secondary**: Description-based AI generation  
3. **Tertiary**: Static fallback vibes

## Configuration

### Environment Variables
```bash
# Optional: Customize API endpoints
MOOD_API_BASE=http://localhost:5000/api/v1
GOODREADS_DELAY_MIN=1  # Minimum delay between requests
GOODREADS_DELAY_MAX=3  # Maximum delay between requests
```

### Mood Keywords Customization
Edit `mood_keywords` dictionary in `mood_analyzer.py`:
```python
self.mood_keywords = {
    'cozy': ['cozy', 'warm', 'comfort', ...],
    'dark': ['dark', 'grim', 'disturbing', ...],
    # Add custom moods here
}
```

## Troubleshooting

### Common Issues

**"No reviews found"**
- Book may not exist on GoodReads
- Title/author spelling may be incorrect
- GoodReads may be blocking requests (try different book)

**"Mood analysis not available"**
- Backend server may not be running
- Check `http://localhost:5000/api/v1/health` (GET request)
- **Don't visit POST endpoints in browser** - they will return 405 Method Not Allowed (expected behavior)
- Use curl or the frontend JavaScript to test POST endpoints
- Verify CORS settings for cross-origin requests

**Slow performance**
- Enable caching (should be automatic)
- Reduce `max_reviews` parameter
- Check network connection

### Debug Mode
Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Contributing

### Adding New Moods
1. Add keywords to `mood_keywords` in `mood_analyzer.py`
2. Add CSS styling in `style.css` (`.mood-{name}` class)
3. Update documentation

### Improving Sentiment Analysis
- Experiment with different sentiment libraries
- Adjust mood keyword weights
- Fine-tune vibe generation logic

### Enhancing UI
- Add mood filtering to search
- Create mood-based book recommendations
- Implement mood trend visualization

## Future Enhancements

### Planned Features
- **Mood-Based Search**: Filter books by detected moods
- **Trend Analysis**: Track mood popularity over time
- **User Preferences**: Learn user mood preferences
- **Social Features**: Share mood analyses with friends

### Technical Improvements
- **Database Integration**: Replace JSON cache with PostgreSQL
- **Machine Learning**: Train custom mood classification models
- **Real-time Updates**: WebSocket-based live mood updates
- **Performance**: Async processing and background tasks

## License

This feature is part of BiblioDrift and follows the same MIT License.

## Acknowledgments

- **VADER Sentiment**: Hutto, C.J. & Gilbert, E.E. (2014)
- **TextBlob**: Steven Loria and contributors
- **GoodReads**: Book data and review content
- **BiblioDrift Community**: Feature inspiration and feedback