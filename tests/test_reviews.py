"""Tests for duplicate review prevention and review upsert behavior."""

import pytest

from backend.models import Review, ReviewEditHistory, db


GOOGLE_BOOKS_ID = "zyTCAlFPjcYC"


def _post_review(client, user_id, rating=5, review_text="Great book", google_books_id=GOOGLE_BOOKS_ID):
    return client.post(
        "/api/v1/reviews",
        json={
            "user_id": user_id,
            "google_books_id": google_books_id,
            "rating": rating,
            "review_text": review_text,
            "title": "Test Book",
            "authors": "Test Author",
        },
    )


def test_create_review_returns_201(auth_client, test_user, test_book):
    resp = _post_review(auth_client, test_user.id)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["message"] == "Review created successfully"
    assert data["review"]["rating"] == 5
    assert data["review"]["edit_count"] == 0


def test_duplicate_review_updates_instead_of_inserting(auth_client, test_user, test_book):
    first = _post_review(auth_client, test_user.id, rating=5, review_text="First take")
    assert first.status_code == 201
    created_at = first.get_json()["review"]["created_at"]

    second = _post_review(auth_client, test_user.id, rating=3, review_text="Updated take")
    assert second.status_code == 200
    body = second.get_json()
    assert body["message"] == "Review updated successfully"
    assert body["review"]["rating"] == 3
    assert body["review"]["review_text"] == "Updated take"
    assert body["review"]["created_at"] == created_at
    assert body["review"]["edit_count"] == 1

    with auth_client.application.app_context():
        assert Review.query.filter_by(user_id=test_user.id, book_id=test_book.id).count() == 1
        assert ReviewEditHistory.query.count() == 1


def test_soft_deleted_review_is_restored_on_resubmit(auth_client, test_user, test_book):
    create_resp = _post_review(auth_client, test_user.id)
    review_id = create_resp.get_json()["review"]["id"]

    delete_resp = auth_client.delete(f"/api/v1/reviews/{review_id}")
    assert delete_resp.status_code == 200

    resubmit = _post_review(auth_client, test_user.id, rating=4, review_text="Back again")
    assert resubmit.status_code == 200
    body = resubmit.get_json()
    assert body["review"]["id"] == review_id
    assert body["review"]["rating"] == 4
    assert body["review"]["is_deleted"] is False

    with auth_client.application.app_context():
        assert Review.query.filter_by(user_id=test_user.id, book_id=test_book.id).count() == 1


def test_get_book_reviews_returns_average(auth_client, test_user, test_book):
    _post_review(auth_client, test_user.id, rating=4)
    resp = auth_client.get(f"/api/v1/reviews/{GOOGLE_BOOKS_ID}")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["total_reviews"] == 1
    assert data["average_rating"] == 4.0


def test_unauthorized_user_cannot_review_for_another_user(auth_client, test_user, test_book):
    resp = auth_client.post(
        "/api/v1/reviews",
        json={
            "user_id": test_user.id + 999,
            "google_books_id": GOOGLE_BOOKS_ID,
            "rating": 5,
            "review_text": "Sneaky review",
        },
    )
    assert resp.status_code == 403


def test_review_requires_authentication(client, test_user, test_book):
    resp = _post_review(client, test_user.id)
    assert resp.status_code == 401
