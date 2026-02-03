#!/usr/bin/env python3
"""
Test script for BiblioDrift GoodReads Mood Analysis
Tests the complete workflow from scraping to mood analysis
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mood_analysis.goodreads_scraper import GoodReadsReviewScraper
from mood_analysis.mood_analyzer import BookMoodAnalyzer

def test_scraper():
    """Test the GoodReads scraper with a popular book."""
    print("=== Testing GoodReads Scraper ===")
    
    scraper = GoodReadsReviewScraper()
    
    # Test with a well-known book
    test_books = [
        ("The Seven Husbands of Evelyn Hugo", "Taylor Jenkins Reid"),
        ("Where the Crawdads Sing", "Delia Owens"),
        ("The Silent Patient", "Alex Michaelides")
    ]
    
    for title, author in test_books:
        print(f"\nTesting: {title} by {author}")
        
        # Test search functionality
        book_url = scraper.search_book_by_title(title, author)
        if book_url:
            print(f"✓ Found book URL: {book_url}")
        else:
            print(f"✗ Could not find book")
            continue
        
        # Test review scraping (limit to 5 for testing)
        reviews = scraper.scrape_reviews(book_url, max_reviews=5)
        print(f"✓ Scraped {len(reviews)} reviews")
        
        if reviews:
            print(f"Sample review: {reviews[0]['text'][:100]}...")
        
        break  # Only test first book to avoid rate limiting

def test_mood_analyzer():
    """Test the mood analysis with sample reviews."""
    print("\n=== Testing Mood Analyzer ===")
    
    analyzer = BookMoodAnalyzer()
    
    # Sample reviews for testing
    sample_reviews = [
        {
            'text': "This book was absolutely magical! The characters were so well-developed and the romance was swoon-worthy. I couldn't put it down and found myself completely lost in the cozy atmosphere of the small town setting. Perfect for a rainy day!",
            'rating': 5
        },
        {
            'text': "A dark and twisted tale that kept me on the edge of my seat. The mystery was intricate and the atmosphere was haunting. Not for the faint of heart, but brilliantly written. The psychological elements were disturbing yet compelling.",
            'rating': 4
        },
        {
            'text': "Heartwarming and uplifting story that made me cry happy tears. The characters felt like real people and their journey was so inspiring. This book gave me hope and made me believe in the power of human connection.",
            'rating': 5
        }
    ]
    
    print(f"Analyzing {len(sample_reviews)} sample reviews...")
    
    result = analyzer.determine_primary_mood(sample_reviews)
    
    print("\n--- Mood Analysis Results ---")
    print(f"Overall Sentiment: {result['overall_sentiment']['compound_score']}")
    print(f"Primary Moods: {[mood['mood'] for mood in result['primary_moods']]}")
    print(f"Mood Description: {result['mood_description']}")
    print(f"BiblioDrift Vibe: {result['bibliodrift_vibe']}")

def test_ai_service():
    """Test the complete AI service integration."""
    print("\n=== Testing AI Service Integration ===")
    
    ai_service = AIBookService()
    
    # Test with a book that should have reviews
    test_title = "The Seven Husbands of Evelyn Hugo"
    test_author = "Taylor Jenkins Reid"
    
    print(f"Testing mood analysis for: {test_title}")
    
    try:
        mood_analysis = ai_service.analyze_book_mood(test_title, test_author)
        
        if mood_analysis:
            print("✓ Mood analysis successful!")
            print(f"Primary moods: {[mood['mood'] for mood in mood_analysis.get('primary_moods', [])]}")
            print(f"BiblioDrift vibe: {mood_analysis.get('bibliodrift_vibe', 'N/A')}")
        else:
            print("✗ Mood analysis failed")
            
    except Exception as e:
        print(f"✗ Error in mood analysis: {e}")

def test_fallback_generation():
    """Test fallback vibe generation."""
    print("\n=== Testing Fallback Vibe Generation ===")
    
    from ai_service import generate_book_note
    
    test_descriptions = [
        "A short description",
        "A medium length description that has some content but not too much detail about the story",
        "A very long and detailed description that goes into great depth about the characters, plot, setting, and themes of the book, providing extensive background information and context for potential readers who want to know exactly what they're getting into before they start reading this particular novel."
    ]
    
    for i, desc in enumerate(test_descriptions):
        vibe = generate_book_note(desc)
        print(f"Description {i+1} ({len(desc)} chars): {vibe}")

def main():
    """Run all tests."""
    print("BiblioDrift GoodReads Mood Analysis - Test Suite")
    print("=" * 50)
    
    try:
        # Test individual components
        test_mood_analyzer()  # Start with this since it doesn't require network
        test_fallback_generation()
        
        # Network-dependent tests (comment out if no internet)
        print("\nNote: Skipping network tests to avoid rate limiting during development.")
        print("To test scraping, uncomment the lines below and run with internet connection.")
        # test_scraper()
        # test_ai_service()
        
        print("\n" + "=" * 50)
        print("✓ Test suite completed!")
        print("\nTo test the complete workflow:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Run the Flask server: python app.py")
        print("3. Test API endpoints with curl or Postman")
        
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()