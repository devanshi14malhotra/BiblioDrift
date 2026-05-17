"""
Handles semantic similarity using sentence embeddings.
"""
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

"""
Generates embeddings and compares semantic similarity.
"""


class EmbeddingEngine:

    def __init__(self):

        self.model = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )

    def get_embedding(self, text):

        return self.model.encode([text])

    def compare_texts(self, text1, text2):

        embedding1 = self.get_embedding(text1)

        embedding2 = self.get_embedding(text2)

        similarity = cosine_similarity(
            embedding1,
            embedding2
        )[0][0]

        return float(similarity)