import requests

def fetch_book_data(book_name):
    """
    Fetch metadata for a book using Google Books API
    """

    url = f"https://www.googleapis.com/books/v1/volumes?q={book_name}"

    try:
        response = requests.get(url)

        # Check if request successful
        if response.status_code != 200:
            print("Error fetching data")
            return None

        data = response.json()

        # Check if books found
        if "items" not in data:
            print(f"No results found for '{book_name}'")
            return None

        book = data["items"][0]["volumeInfo"]

        # Extract required fields safely
        book_data = {
            "title": book.get("title", "N/A"),
            "authors": ", ".join(book.get("authors", ["Unknown"])),
            "genre": ", ".join(book.get("categories", ["Unknown"])),
            "description": book.get("description", "No description available"),
            "thumbnail": book.get("imageLinks", {}).get("thumbnail", "No image"),
            "rating": book.get("averageRating", "Not Rated")
        }

        return book_data

    except Exception as e:
        print("Error:", e)
        return None