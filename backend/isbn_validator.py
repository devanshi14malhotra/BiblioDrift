"""
ISBN validation utilities for BiblioDrift.
"""

import re


def normalize_isbn(isbn: str) -> str:
    """Remove spaces and hyphens from an ISBN."""
    if not isinstance(isbn, str):
        raise TypeError("ISBN must be a string")

    return re.sub(r"[\s-]", "", isbn).upper()


def validate_isbn10(isbn: str) -> bool:
    """Validate ISBN-10 using checksum verification."""
    try:
        normalized = normalize_isbn(isbn)
    except TypeError:
        return False

    if len(normalized) != 10:
        return False

    if not re.fullmatch(r"\d{9}[\dX]", normalized):
        return False

    total = 0
    for index, char in enumerate(normalized):
        value = 10 if char == "X" else int(char)
        total += (10 - index) * value

    return total % 11 == 0


def validate_isbn13(isbn: str) -> bool:
    """Validate ISBN-13 using checksum verification."""
    try:
        normalized = normalize_isbn(isbn)
    except TypeError:
        return False

    if len(normalized) != 13:
        return False

    if not normalized.isdigit():
        return False

    total = 0
    for index, char in enumerate(normalized):
        weight = 1 if index % 2 == 0 else 3
        total += int(char) * weight

    return total % 10 == 0


def is_valid_isbn(isbn: str) -> bool:
    """Validate either ISBN-10 or ISBN-13."""
    try:
        normalized = normalize_isbn(isbn)
    except TypeError:
        return False

    if len(normalized) == 10:
        return validate_isbn10(normalized)

    if len(normalized) == 13:
        return validate_isbn13(normalized)

    return False
