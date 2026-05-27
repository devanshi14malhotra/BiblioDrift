"""
Handles unsupervised reader clustering.
"""
"""
Uses TF-IDF and KMeans clustering for grouping readers.
"""


class ClusterEngine:

    def __init__(self):
        self.vectorizer = None

    def cluster_reviews(self, reviews):
        if not reviews:
            return [-1]

        try:
            from sklearn.cluster import KMeans
            if self.vectorizer is None:
                from sklearn.feature_extraction.text import TfidfVectorizer
                self.vectorizer = TfidfVectorizer(
                    stop_words="english"
                )
            vectors = self.vectorizer.fit_transform(
                reviews
            )

            cluster_count = min(
                len(reviews),
                4
            )
            if cluster_count == 0:
                return [-1]

            model = KMeans(
                n_clusters=cluster_count,
                random_state=42
            )

            clusters = model.fit_predict(
                vectors
            )

            return clusters.tolist()
        except Exception:
            return [-1]