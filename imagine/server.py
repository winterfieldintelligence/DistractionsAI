import base64
import os
from flask import Flask, jsonify, request, send_from_directory
app = Flask(__name__, static_folder=".", static_url_path="")

@app.route("/")
def root():
    return send_from_directory(".", "index.html")

@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "Prompt required"}), 400

    # No OpenAI integration in this deployment.
    # Return a friendly message so the UI can fall back gracefully.
    return jsonify({"error": "Image generation disabled"}), 501

if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set")
    app.run(host="0.0.0.0", port=5000, debug=True)
