"""
Handles sentiment analysis for reader reviews.
"""

from textblob import TextBlob

"""
Performs sentiment-based emotional profiling.
"""

class SentimentEngine:

    def analyze_reviews(self, reviews):

        combined_text = " ".join(reviews)

        blob = TextBlob(combined_text)

        polarity = blob.sentiment.polarity

        if polarity > 0.5:
            mood = "Highly Positive Reader"

        elif polarity > 0:
            mood = "Optimistic Reader"

        elif polarity < -0.5:
            mood = "Dark Emotional Reader"

        elif polarity < 0:
            mood = "Reflective Reader"

        else:
            mood = "Balanced Analytical Reader"

        return {
            "sentiment_score": polarity,
            "reader_mood": mood
        }