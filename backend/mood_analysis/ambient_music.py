# Ambient music mapper: maps a parsed mood query to a curated open
# Spotify playlist. Pure keyword matching on the moods/themes already
# extracted by MoodQueryParser - no extra LLM call, no external API.

from typing import Dict, Optional

# ponytail: static curated list; swap in Spotify API search if curation matters later.
MOOD_PLAYLISTS = [
    # (keywords over moods+themes+raw query, genre label, playlist embed URL)
    (
        {"dark", "mysterious", "gothic", "melancholic"},
        "Dark Academia Jazz",
        "https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO",
    ),
    (
        {"cozy"},
        "Cozy Reading Cafe",
        "https://open.spotify.com/embed/playlist/37i9dQZF1DX4WYpdgoIcn6",
    ),
    (
        {"whimsical", "uplifting"},
        "Whimsical & Light",
        "https://open.spotify.com/embed/playlist/37i9dQZF1DX7EF8wVxBVhG",
    ),
    (
        {"atmospheric", "thoughtful"},
        "Classical Reading",
        "https://open.spotify.com/embed/playlist/37i9dQZF1DX8ymr6UES7vc",
    ),
]

DEFAULT_PLAYLIST = (
    {"genre": "Lo-Fi Reading Chill",
     "spotify_embed_url": "https://open.spotify.com/embed/playlist/37i9dQZF1DX889Y07vA7vH"}
)


def get_ambient_music(query: str, primary_moods=None) -> Dict:
    """Return an ambient_music payload for a mood query."""
    haystack = set((primary_moods or []))
    tokens = {t.strip(".,!?") for t in query.lower().split()}
    haystack |= tokens

    best: Optional[tuple] = None
    best_score = 0
    for keywords, genre, url in MOOD_PLAYLISTS:
        score = len(keywords & haystack)
        if score > best_score:
            best_score = score
            best = (genre, url)

    if best:
        return {"genre": best[0], "spotify_embed_url": best[1]}
    return dict(DEFAULT_PLAYLIST)


def self_check():
    assert get_ambient_music("cozy autumn night with warm tea")["genre"] == "Cozy Reading Cafe"
    assert get_ambient_music("dark academia gothic mystery")["genre"] == "Dark Academia Jazz"
    assert get_ambient_music("something random")["genre"] == DEFAULT_PLAYLIST["genre"]
    r = get_ambient_music("cozy", ["cozy"])
    assert r["spotify_embed_url"].startswith("https://open.spotify.com/embed/")
    print("ambient_music self-check passed")


if __name__ == "__main__":
    self_check()
