import pytest

from backend.isbn_validator import (
    normalize_isbn,
    validate_isbn10,
    validate_isbn13,
    is_valid_isbn,
)


def test_normalize_isbn_removes_spaces_and_hyphens():
    assert normalize_isbn("978-0-306-40615-7") == "9780306406157"
    assert normalize_isbn("0 306 40615 2") == "0306406152"


def test_normalize_isbn_uppercases_x():
    assert normalize_isbn("0-8044-2957-x") == "080442957X"


def test_normalize_isbn_rejects_non_string():
    with pytest.raises(TypeError):
        normalize_isbn(9780306406157)


@pytest.mark.parametrize(
    "isbn",
    [
        "0306406152",
        "0-306-40615-2",
        "080442957X",
        "0-8044-2957-X",
    ],
)
def test_valid_isbn10(isbn):
    assert validate_isbn10(isbn) is True


@pytest.mark.parametrize(
    "isbn",
    [
        "0306406153",
        "0-306-40615-X",
        "1234567890",
        "ABCDEFGHIJ",
        "030640615",
        "03064061522",
        None,
    ],
)
def test_invalid_isbn10(isbn):
    assert validate_isbn10(isbn) is False


@pytest.mark.parametrize(
    "isbn",
    [
        "9780306406157",
        "978-0-306-40615-7",
        "9783161484100",
        "978-3-16-148410-0",
    ],
)
def test_valid_isbn13(isbn):
    assert validate_isbn13(isbn) is True


@pytest.mark.parametrize(
    "isbn",
    [
        "9780306406158",
        "978030640615",
        "97803064061577",
        "97803064061X7",
        "",
        None,
    ],
)
def test_invalid_isbn13(isbn):
    assert validate_isbn13(isbn) is False


def test_is_valid_isbn_accepts_valid_isbn10_and_isbn13():
    assert is_valid_isbn("0306406152") is True
    assert is_valid_isbn("9780306406157") is True


def test_is_valid_isbn_rejects_invalid_values():
    assert is_valid_isbn("123") is False
    assert is_valid_isbn("not-an-isbn") is False
    assert is_valid_isbn(None) is False
