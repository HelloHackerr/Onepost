from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import google.generativeai as genai
import requests
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ============================================
# KEYS FROM ENVIRONMENT VARIABLES (set in Render)
# ============================================
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
YOUTUBE_CLIENT_ID = os.environ.get("YOUTUBE_CLIENT_ID")
YOUTUBE_CLIENT_SECRET = os.environ.get("YOUTUBE_CLIENT_SECRET")
YOUTUBE_REFRESH_TOKEN = os.environ.get("YOUTUBE_REFRESH_TOKEN")
META_PAGE_TOKEN = os.environ.get("META_PAGE_TOKEN")
META_PAGE_ID = os.environ.get("META_PAGE_ID")
INSTAGRAM_ACCOUNT_ID = os.environ.get("INSTAGRAM_ACCOUNT_ID")
# ============================================

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)


# ── Helper: Get YouTube Access Token ─────────
def get_youtube_token():
    token_res = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": YOUTUBE_CLIENT_ID,
        "client_secret": YOUTUBE_CLIENT_SECRET,
        "refresh_token": YOUTUBE_REFRESH_TOKEN,
        "grant_type": "refresh_token"
    })
    return token_res.json().get("access_token")


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
Respond ONLY in JSON format, no markdown, no backticks:
{{"title":"...","description":"..."}}"""

    try:
        model = genai.GenerativeModel("gemini-pro")
        response = model.generate_content(prompt)
        text = response.text
        clean = text.replace("```json", "").replace("```", "").strip()
        result = json.loads(clean)
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
        thumbnail = request.files.get("thumbnail")  # Optional thumbnail

        access_token = get_youtube_token()

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

        if upload_res.status_code != 200:
            return jsonify({"success": False, "error": upload_res.text}), 400

        video_id = upload_res.json().get("id")

        # Upload thumbnail if provided
        if thumbnail:
            thumb_res = requests.post(
                f"https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={video_id}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": thumbnail.content_type
                },
                data=thumbnail.stream.read()
            )
            if thumb_res.status_code != 200:
                # Video uploaded but thumbnail failed
                return jsonify({
                    "success": True,
                    "url": f"https://youtube.com/watch?v={video_id}",
                    "warning": "Video uploaded but thumbnail failed. Make sure your YouTube account is verified."
                })

        return jsonify({
            "success": True,
            "url": f"https://youtube.com/watch?v={video_id}",
            "thumbnail": "uploaded" if thumbnail else "auto-generated"
        })

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
        thumbnail = request.files.get("thumbnail")  # Optional thumbnail

        params = {
            "title": title,
            "description": description,
            "access_token": META_PAGE_TOKEN
        }

        if schedule_time:
            dt = datetime.fromisoformat(schedule_time)
            params["scheduled_publish_time"] = int(dt.timestamp())
            params["published"] = "false"

        # Prepare files
        files = {
            "source": (video.filename, video.stream, video.content_type)
        }

        # Add thumbnail if provided
        if thumbnail:
            files["thumb"] = (thumbnail.filename, thumbnail.stream, thumbnail.content_type)

        upload_res = requests.post(
            f"https://graph.facebook.com/v18.0/{META_PAGE_ID}/videos",
            params=params,
            files=files
        )

        if upload_res.status_code == 200:
            video_id = upload_res.json().get("id")
            return jsonify({
                "success": True,
                "url": f"https://facebook.com/video/{video_id}",
                "thumbnail": "uploaded" if thumbnail else "auto-generated"
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
        thumbnail = request.files.get("thumbnail")  # Optional cover image

        # Step 1: Create container
        params = {
            "media_type": "REELS",
            "caption": caption,
            "access_token": META_PAGE_TOKEN
        }

        files = {
            "video_url": (video.filename, video.stream, video.content_type)
        }

        # Add cover image if provided
        if thumbnail:
            files["cover_url"] = (thumbnail.filename, thumbnail.stream, thumbnail.content_type)

        container_res = requests.post(
            f"https://graph.facebook.com/v18.0/{INSTAGRAM_ACCOUNT_ID}/media",
            params=params,
            files=files
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
            return jsonify({
                "success": True,
                "message": "Posted to Instagram!",
                "thumbnail": "uploaded" if thumbnail else "auto-generated"
            })
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
