from flask import Flask # type: ignore
import mangum # type: ignore

app = Flask(__name__)

@app.route("/")
def home():
    return "Hello from Flask on Netlify"

handler = mangum.Mangum(app)
