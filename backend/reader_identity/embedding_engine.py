"""
Handles semantic similarity using sentence embeddings.
Supports clean fallback to lexical similarity when deep learning dependencies are unavailable.
"""
import logging

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False
    logger.warning("sentence-transformers or scikit-learn not available. Falling back to zero-dependency keyword similarity engine.")


class EmbeddingEngine:

    def __init__(self):
        if HAS_TRANSFORMERS:
            try:
                self.model = SentenceTransformer("all-MiniLM-L6-v2")
            except Exception as e:
                logger.error(f"Failed to load SentenceTransformer: {e}. Using fallback similarity.")
                self.model = None
        else:
            self.model = None

    def get_embedding(self, text):
        if self.model:
            return self.model.encode([text])
        return None

    def compare_texts(self, text1, text2):
        if self.model and HAS_TRANSFORMERS:
            try:
                embedding1 = self.get_embedding(text1)
                embedding2 = self.get_embedding(text2)
                similarity = cosine_similarity(
                    embedding1,
                    embedding2
                )[0][0]
                return float(similarity)
            except Exception as e:
                logger.error(f"Transformer similarity calculation failed: {e}. Falling back to lexical similarity.")
        
        # Zero-dependency clean keyword lexical similarity
        words1 = {w.strip(".,!?\"'()[]{}") for w in text1.lower().split() if len(w) > 2}
        words2 = {w.strip(".,!?\"'()[]{}") for w in text2.lower().split() if len(w) > 2}
        
        if not words1 or not words2:
            return 0.0
            
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return float(len(intersection)) / float(len(union))