import json
import csv
import os


JSON_FILE = "books.json"
CSV_FILE = "books.csv"


def load_existing_books():
    """
    Load existing books from JSON file
    """

    if not os.path.exists(JSON_FILE):
        return []

    with open(JSON_FILE, "r") as file:
        try:
            return json.load(file)
        except:
            return []


def is_duplicate(title, existing_books):
    """
    Check duplicate book titles
    """

    for book in existing_books:
        if book["title"].lower() == title.lower():
            return True

    return False


def save_to_json(book_data):
    """
    Save book data into JSON
    """

    existing_books = load_existing_books()

    if is_duplicate(book_data["title"], existing_books):
        print("Duplicate book found. Skipping...")
        return

    existing_books.append(book_data)

    with open(JSON_FILE, "w") as file:
        json.dump(existing_books, file, indent=4)

    print("Book saved to JSON successfully.")


def save_to_csv(book_data):
    """
    Save book data into CSV
    """

    file_exists = os.path.exists(CSV_FILE)

    with open(CSV_FILE, "a", newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=book_data.keys())

        # Write header only once
        if not file_exists:
            writer.writeheader()

        writer.writerow(book_data)

    print("Book saved to CSV successfully.")