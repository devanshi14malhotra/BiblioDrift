from scraper import fetch_book_data
from utils import save_to_json, save_to_csv


def main():

    print("===== Book Metadata Scraper =====")

    while True:

        book_name = input("\nEnter book name (or type 'exit'): ")

        if book_name.lower() == "exit":
            print("Exiting program...")
            break

        book_data = fetch_book_data(book_name)

        if book_data:

            print("\nBook Data Fetched Successfully:\n")

            for key, value in book_data.items():
                print(f"{key}: {value}")

            #Save the Date
            save_to_json(book_data)
            save_to_csv(book_data)

        else:
            print("Could not fetch book data.")


if __name__ == "__main__":
    main()