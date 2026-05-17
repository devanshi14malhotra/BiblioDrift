import urllib.request
import json
import time

# Genres to fetch to build a diverse catalog of ~300 books
SUBJECTS = [
    ('romance', 30),
    ('mystery', 30),
    ('thriller', 30),
    ('fantasy', 40),
    ('science_fiction', 30),
    ('historical_fiction', 30),
    ('poetry', 20),
    ('hindi', 40),        # Hindi language / literature
    ('comedy', 20),
    ('tragedy', 15),
    ('adventure', 15)
]

catalog = []
book_ids = set()

def fetch_books(subject, limit):
    print(f"Fetching {limit} books for subject '{subject}'...")
    url = f"https://openlibrary.org/subjects/{subject}.json?limit={limit}&details=true"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'BiblioDriftCatalog/1.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            works = data.get('works', [])
            
            for work in works:
                key = work.get('key', '')
                if key in book_ids:
                    continue
                    
                title = work.get('title', 'Unknown Title')
                authors = [a.get('name') for a in work.get('authors', [])]
                if not authors:
                    authors = ['Unknown Author']
                
                # Cover ID
                cover_id = work.get('cover_id')
                image_url = f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg" if cover_id else None
                
                # Extract subject categories (limiting to 5)
                categories = work.get('subject', [])
                # Ensure the main searched subject is included
                main_cat = subject.replace('_', ' ').title()
                if main_cat not in categories:
                    categories.insert(0, main_cat)
                categories = categories[:5]

                # Some openlibrary subjects don't return description easily, so we will generate a small placeholder or leave it blank if missing.
                # Actually OpenLibrary subject API doesn't return full descriptions. 
                # We will just append the categories to serve as a description for the local search algorithm.
                description = f"A prominent {main_cat} book exploring themes of {', '.join(categories[1:4])}."
                if 'hindi' in subject.lower():
                    description = f"A classic Hindi book exploring themes of {', '.join(categories[1:4])}."

                catalog.append({
                    'id': key,
                    'volumeInfo': {
                        'title': title,
                        'authors': authors,
                        'description': description,
                        'categories': categories,
                        'imageLinks': { 'thumbnail': image_url } if image_url else None
                    }
                })
                book_ids.add(key)
                
    except Exception as e:
        print(f"Error fetching {subject}: {e}")

for subject, limit in SUBJECTS:
    fetch_books(subject, limit)
    time.sleep(1) # Be nice to the API

# Also re-append the manually curated favorites we added previously
favorites = [
    {
        'id': 'local_1',
        'volumeInfo': {
            'title': 'The Night Circus',
            'authors': ['Erin Morgenstern'],
            'description': 'A magical, melancholy romance set in a mysterious wandering circus.',
            'categories': ['Fantasy', 'Romance', 'Magic', 'Melancholy'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=Z01n0zB5Z_oC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    },
    {
        'id': 'local_2',
        'volumeInfo': {
            'title': 'The Secret History',
            'authors': ['Donna Tartt'],
            'description': 'A dark, thrilling tale of a group of eccentric students and a fatal secret.',
            'categories': ['Mystery', 'Thriller', 'Tragedy'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=E8m_eK1G6ZQC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    },
    {
        'id': 'local_3',
        'volumeInfo': {
            'title': 'A Psalm for the Wild-Built',
            'authors': ['Becky Chambers'],
            'description': 'A cozy, healing sci-fi journey about a tea monk and a robot.',
            'categories': ['Sci-Fi', 'Cozy', 'Healing', 'Adventure'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=h3P1DwAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    },
    {
        'id': 'local_4',
        'volumeInfo': {
            'title': 'Pride and Prejudice',
            'authors': ['Jane Austen'],
            'description': 'A classic historical comedy of manners and enemies-to-lovers romance.',
            'categories': ['Romance', 'Historical', 'Comedy'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=s1gVAAAAYAAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    },
    {
        'id': 'local_5',
        'volumeInfo': {
            'title': 'The Book Thief',
            'authors': ['Markus Zusak'],
            'description': 'A tragic, beautiful historical novel narrated by Death.',
            'categories': ['Historical', 'Tragedy', 'Grief', 'Melancholy'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=mF_1wB2H6KUC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    },
    {
        'id': 'local_6',
        'volumeInfo': {
            'title': 'Godan (The Gift of a Cow)',
            'authors': ['Munshi Premchand'],
            'description': 'A classic Hindi novel depicting the socio-economic deprivation and struggles of a poor peasant.',
            'categories': ['Hindi', 'Classic', 'Fiction', 'Tragedy', 'Drama'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=38e3EAAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    },
    {
        'id': 'local_7',
        'volumeInfo': {
            'title': 'Rashmirathi',
            'authors': ['Ramdhari Singh Dinkar'],
            'description': 'An epic Hindi poem focusing on the life of Karna from the Mahabharata, dealing with honor, justice, and destiny.',
            'categories': ['Hindi', 'Poetry', 'Mythology', 'Historical'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=J-v5EAAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    },
    {
        'id': 'local_8',
        'volumeInfo': {
            'title': 'Madhushala',
            'authors': ['Harivansh Rai Bachchan'],
            'description': 'A highly celebrated philosophical Hindi poem using the metaphor of a tavern to explain the complexities of life.',
            'categories': ['Hindi', 'Poetry', 'Philosophy', 'Classic'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=XwJ2wAEACAAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    },
    {
        'id': 'local_9',
        'volumeInfo': {
            'title': 'Dune',
            'authors': ['Frank Herbert'],
            'description': 'A sweeping sci-fi epic about politics, religion, and survival on a harsh desert planet.',
            'categories': ['Sci-Fi', 'Adventure', 'Action', 'Fantasy'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=B1hSG45JCX4C&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    },
    {
        'id': 'local_10',
        'volumeInfo': {
            'title': 'The Hobbit',
            'authors': ['J.R.R. Tolkien'],
            'description': 'A cozy but thrilling fantasy adventure about a hobbit who goes on an unexpected journey.',
            'categories': ['Fantasy', 'Adventure', 'Cozy', 'Classic'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=pD6arNyKyi8C&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    },
    {
        'id': 'local_11',
        'volumeInfo': {
            'title': 'Gone Girl',
            'authors': ['Gillian Flynn'],
            'description': 'A dark, psychological thriller involving a missing wife and a web of deceit.',
            'categories': ['Thriller', 'Mystery', 'Crime', 'Drama'],
            'imageLinks': { 'thumbnail': 'https://books.google.com/books/content?id=k_9Yq1wP5qUC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }
        }
    }
]

# Ensure favorites are not duplicated
for fav in favorites:
    if fav['id'] not in book_ids:
        catalog.insert(0, fav)

import os
os.makedirs('frontend/js', exist_ok=True)
with open('frontend/js/catalog.json', 'w', encoding='utf-8') as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print(f"Successfully generated catalog.json with {len(catalog)} books!")
