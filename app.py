# Placeholder for Flask backend application structure.
# Initialize Flask app, configure CORS, and setup database connection here.

from flask import Flask, request, jsonify
from flask_cors import CORS
from ai_service import generate_book_note
from models import db, User, register_user, login_user

app = Flask(__name__)
CORS(app)

@app.route('/api/v1/generate-note', methods=['POST'])
def handle_generate_note():
    data = request.json
    description = data.get('description', '')
    vibe = generate_book_note(description)
    return jsonify({"vibe": vibe})

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///biblio.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)


@app.route('/api/v1/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    if not username or not email or not password:
        return jsonify({"error": "Missing fields"}), 400

    try:
        register_user(username, email, password)
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/v1/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"error": "Missing fields"}), 400

    if login_user(username, password):
        return jsonify({"message": "Login successful"}), 200
    return jsonify({"error": "Invalid username or password"}), 401

with app.app_context():
    db.create_all()  # creates User & ShelfItem tables

if __name__ == '__main__':
    print("--- SERVER STARTING ON PORT 5000 ---")
    app.run(debug=True, port=5000)