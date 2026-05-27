from sqlalchemy import event, text

from backend.models import Collection, db


def test_public_collections_does_not_n_plus_one(client, test_user):
    c = Collection(user_id=test_user.id, name="Public", description="d", is_public=True)
    db.session.add(c)
    db.session.commit()

    # Warm up the connection to avoid counting initial SQLite PRAGMAs.
    db.session.execute(text("SELECT 1"))

    query_count = {"n": 0}

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        query_count["n"] += 1

    event.listen(db.engine, "before_cursor_execute", before_cursor_execute)
    try:
        resp = client.get("/api/v1/collections/public?limit=20&offset=0")
    finally:
        event.remove(db.engine, "before_cursor_execute", before_cursor_execute)

    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["total"] == 1
    assert payload["collections"][0]["owner_username"] == "testuser"

    # Expect a small constant number of queries (collections, items subquery, count).
    # Old implementation was N+1 (~1 + N user lookups).
    assert query_count["n"] <= 6
