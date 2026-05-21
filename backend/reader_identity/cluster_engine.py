"""
Handles unsupervised reader clustering.
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
"""
Uses TF-IDF and KMeans clustering for grouping readers.
"""


class ClusterEngine:

    def __init__(self):

        self.vectorizer = TfidfVectorizer(
            stop_words="english"
        )

    def cluster_reviews(self, reviews):

        vectors = self.vectorizer.fit_transform(
            reviews
        )

        cluster_count = min(
            len(reviews),
            4
        )

        model = KMeans(
            n_clusters=cluster_count,
            random_state=42
        )

        clusters = model.fit_predict(
            vectors
        )

        return clusters.tolist()