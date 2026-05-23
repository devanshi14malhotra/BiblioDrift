"""
Main orchestration engine for reader identity generation.
"""
from .sentiment_engine import SentimentEngine
from .embedding_engine import EmbeddingEngine
from .cluster_engine import ClusterEngine
"""
Combines sentiment, embeddings, and clustering
to generate reader personality profiles.
"""
class ReaderProfileGenerator:
    def __init__(self):
        self.sentiment_engine = SentimentEngine()
        self.embedding_engine = EmbeddingEngine()
        self.cluster_engine = ClusterEngine()

    def generate_profile(self, genres, reviews):

        genres = genres or []
        reviews = reviews or []

        genres_lower = [g.lower() for g in genres]

        review_text = " ".join(reviews).lower()
        archetypes = {
    "Deep Thinker":
        "philosophy existential reflective psychological deep meaning",

    "Emotional Reader":
        "romance heartbreak emotional feelings relationships",

    "Dark Reader":
        "thriller horror dark mystery crime violence",

    "Adventurous Reader":
        "fantasy sci-fi adventure action exploration"
}
        best_match = None

        best_score = -1
        sentiment_result = self.sentiment_engine.analyze_reviews(reviews)
        cluster_result = self.cluster_engine.cluster_reviews(reviews)
        for archetype_name, archetype_text in archetypes.items():
            score = self.embedding_engine.compare_texts(
                review_text,
                archetype_text
                )
            if score > best_score:
                best_score = score
                best_match = archetype_name
                
        archetype = best_match

        return {
    "success": True,
    "reader_profile": {
        "archetype": archetype,
        "genres": genres,
        "review_count": len(reviews),
        "reader_mood": sentiment_result["reader_mood"],
        "sentiment_score": sentiment_result["sentiment_score"],
        "reader_cluster": cluster_result[0],
    }
}