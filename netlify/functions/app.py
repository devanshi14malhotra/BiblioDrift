from flask import Flask
import mangum

app = Flask(__name__)

@app.route("/")
def home():
    return "Hello from Flask on Netlify"

handler = mangum.Mangum(app)
