from flask import Blueprint, request, jsonify

from .profile_generator import ReaderProfileGenerator

reader_identity_bp = Blueprint(
    "reader_identity",
    __name__
)

generator = ReaderProfileGenerator()


@reader_identity_bp.route(
    "/api/v1/reader-archetype",
    methods=["POST"]
)

def reader_archetype():

    try:

        data = request.get_json()

        if not data:

            return jsonify({
                "success": False,
                "error": "Missing JSON body"
            }), 400

        genres = data.get("genres", [])

        reviews = data.get("reviews", [])

        if not reviews:

            return jsonify({
                "success": False,
                "error": "Reviews are required"
            }), 400

        result = generator.generate_profile(
            genres,
            reviews
        )

        return jsonify(result)

    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
def reader_archetype():

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "Missing JSON body"
            }), 400

        genres = data.get("genres", [])
        reviews = data.get("reviews", [])

        if not isinstance(genres, list):
            return jsonify({
                "success": False,
                "error": "genres must be a list"
            }), 400

        if not isinstance(reviews, list):
            return jsonify({
                "success": False,
                "error": "reviews must be a list"
            }), 400

        result = generator.generate_profile(
            genres,
            reviews
        )

        return jsonify(result), 200

    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500