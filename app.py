from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import anthropic
import requests
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Allows JSX frontend to talk to this backend

# ============================================
# PUT YOUR API KEYS HERE
# ============================================
CLAUDE_API_KEY = "your_claude_api_key_here"
YOUTUBE_CLIENT_ID = "your_youtube_client_id_here"
YOUTUBE_CLIENT_SECRET = "your_youtube_client_secret_here"
YOUTUBE_REFRESH_TOKEN = "your_youtube_refresh_token_here"
META_PAGE_TOKEN = "your_meta_page_token_here"
META_PAGE_ID = "your_facebook_page_id_here"
INSTAGRAM_ACCOUNT_ID = "your_instagram_account_id_here"
# ============================================


# ── AI Title & Description Generator ────────
@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    platform = data.get("platform")
    filename = data.get("filename", "video")

    platform_rules = {
        "youtube": "Include SEO keywords, hashtags at end, call to action. Max 100 char title.",
        "facebook": "Conversational tone, encourage shares, add hashtags, use emojis.",
        "instagram": "Short catchy caption, 20-30 hashtags, emoji-rich, call to action."
    }

    prompt = f"""Generate optimized title and description for {platform}.
Video: {filename}
Rules: {platform_rules.get(platform, "")}
Respond ONLY in JSON: {{"title":"...","description":"..."}}"""

    try:
        client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        text = message.content[0].text
        result = json.loads(text.replace("```json", "").replace("```", "").strip())
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── YouTube Upload ───────────────────────────
@app.route("/upload/youtube", methods=["POST"])
def upload_youtube():
    try:
        video = request.files["video"]
        title = request.form.get("title", "My Video")
        description = request.form.get("description", "")
        schedule_time = request.form.get("schedule_time")

        # Get fresh access token
        token_res = requests.post("https://oauth2.googleapis.com/token", data={
            "client_id": YOUTUBE_CLIENT_ID,
            "client_secret": YOUTUBE_CLIENT_SECRET,
            "refresh_token": YOUTUBE_REFRESH_TOKEN,
            "grant_type": "refresh_token"
        })
        access_token = token_res.json().get("access_token")

        # Upload video
        metadata = {
            "snippet": {
                "title": title,
                "description": description,
                "categoryId": "22"
            },
            "status": {
                "privacyStatus": "private" if schedule_time else "public",
                "publishAt": schedule_time if schedule_time else None
            }
        }

        upload_res = requests.post(
            "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status",
            headers={"Authorization": f"Bearer {access_token}"},
            files={
                "metadata": (None, json.dumps(metadata), "application/json"),
                "video": (video.filename, video.stream, video.content_type)
            }
        )

        if upload_res.status_code == 200:
            video_id = upload_res.json().get("id")
            return jsonify({
                "success": True,
                "url": f"https://youtube.com/watch?v={video_id}"
            })
        else:
            return jsonify({"success": False, "error": upload_res.text}), 400

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── Facebook Upload ──────────────────────────
@app.route("/upload/facebook", methods=["POST"])
def upload_facebook():
    try:
        video = request.files["video"]
        title = request.form.get("title", "My Video")
        description = request.form.get("description", "")
        schedule_time = request.form.get("schedule_time")

        params = {
            "title": title,
            "description": description,
            "access_token": META_PAGE_TOKEN
        }

        if schedule_time:
            # Convert to unix timestamp
            dt = datetime.fromisoformat(schedule_time)
            params["scheduled_publish_time"] = int(dt.timestamp())
            params["published"] = "false"

        upload_res = requests.post(
            f"https://graph.facebook.com/v18.0/{META_PAGE_ID}/videos",
            params=params,
            files={"source": (video.filename, video.stream, video.content_type)}
        )

        if upload_res.status_code == 200:
            video_id = upload_res.json().get("id")
            return jsonify({
                "success": True,
                "url": f"https://facebook.com/video/{video_id}"
            })
        else:
            return jsonify({"success": False, "error": upload_res.text}), 400

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── Instagram Upload ─────────────────────────
@app.route("/upload/instagram", methods=["POST"])
def upload_instagram():
    try:
        video = request.files["video"]
        caption = request.form.get("description", "")

        # Step 1: Create container
        container_res = requests.post(
            f"https://graph.facebook.com/v18.0/{INSTAGRAM_ACCOUNT_ID}/media",
            params={
                "media_type": "REELS",
                "caption": caption,
                "access_token": META_PAGE_TOKEN
            },
            files={"video_url": (video.filename, video.stream, video.content_type)}
        )

        container_id = container_res.json().get("id")

        if not container_id:
            return jsonify({"success": False, "error": "Container creation failed"}), 400

        # Step 2: Publish container
        publish_res = requests.post(
            f"https://graph.facebook.com/v18.0/{INSTAGRAM_ACCOUNT_ID}/media_publish",
            params={
                "creation_id": container_id,
                "access_token": META_PAGE_TOKEN
            }
        )

        if publish_res.status_code == 200:
            return jsonify({"success": True, "message": "Posted to Instagram!"})
        else:
            return jsonify({"success": False, "error": publish_res.text}), 400

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── Health Check ─────────────────────────────
@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "OnePost Backend Running ✅"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
