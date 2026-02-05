import base64
import os
from flask import Flask, jsonify, request, send_from_directory
from openai import OpenAI

app = Flask(__name__, static_folder=".", static_url_path="")
client = OpenAI()

@app.route("/")
def root():
    return send_from_directory(".", "index.html")

@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "Prompt required"}), 400

    try:
        response = client.responses.create(
            model="gpt-5",
            input=prompt,
            tools=[{"type": "image_generation"}],
            tool_choice={"type": "image_generation"},
        )
        image_data = [
            output.result
            for output in response.output
            if output.type == "image_generation_call"
        ]
        if not image_data:
            return jsonify({"error": "No image generated"}), 500

        image_base64 = image_data[0]
        image_url = f"data:image/png;base64,{image_base64}"
        return jsonify({"image_url": image_url})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set")
    app.run(host="0.0.0.0", port=5000, debug=True)
