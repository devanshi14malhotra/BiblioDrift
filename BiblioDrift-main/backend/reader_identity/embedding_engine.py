"""
Handles semantic similarity using sentence embeddings.
"""

"""
Generates embeddings and compares semantic similarity.
"""


class EmbeddingEngine:

    def __init__(self):
        self.model = None

    def get_embedding(self, text):
        if self.model is None:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(
                "all-MiniLM-L6-v2"
            )
        return self.model.encode([text])

    def compare_texts(self, text1, text2):
        from sklearn.metrics.pairwise import cosine_similarity

        embedding1 = self.get_embedding(text1)

        embedding2 = self.get_embedding(text2)

        similarity = cosine_similarity(
            embedding1,
            embedding2
        )[0][0]

        return float(similarity)