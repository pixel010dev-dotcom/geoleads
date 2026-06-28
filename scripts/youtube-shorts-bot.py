import os, sys, subprocess, tempfile
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bot_utils import generate_varied_content, generate_post_image, save_image_to_file, download_music

APP_URL = os.environ.get("APP_URL", "https://geoleads-production.up.railway.app")
OUTPUT = os.path.join(tempfile.gettempdir(), "geoleads_short.mp4")


def upload_to_youtube(video_path, title, description, tags):
    try:
        from google.oauth2.credentials import Credentials
        creds = Credentials.from_authorized_user_info({
            "refresh_token": os.environ.get("GOOGLE_REFRESH_TOKEN", ""),
            "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
        })
        youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
        body = {
            "snippet": {
                "title": title,
                "description": f"{description}\n\n📱 Mais dicas no Telegram: @geoleadsextrator",
                "tags": tags + ["Shorts", "Marketing", "Leads", "GeoLeads"],
                "categoryId": "22"
            },
            "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False}
        }
        media = MediaFileUpload(video_path, chunksize=-1, resumable=True)
        request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
        response = request.execute()
        video_id = response.get("id")
        print(f"Video uploaded! ID: {video_id}")
        print(f"URL: https://youtu.be/{video_id}")
        return video_id
    except Exception as e:
        print(f"YouTube upload error: {e}")
        return None


def create_shorts_video(output_path=OUTPUT):
    c = generate_varied_content()
    if not c: print("No content"); return None, None, None, None
    t, text, ip, tags = c
    images = []
    for i in range(3):
        img = generate_post_image(ip or f"digital marketing {i}")
        path = save_image_to_file(img, f"short_{i}") if img else None
        if path: images.append(path)
    if not images: print("No images"); return None, None, None, None
    music = download_music()
    try:
        inputs = []
        filter_parts = []
        for i, img in enumerate(images):
            inputs.extend(["-loop", "1", "-t", "5", "-i", img])
            filter_parts.append(f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[v{i}]")
        if music:
            inputs.extend(["-i", music])
        trans = "".join([f"[v{i}]" for i in range(len(images))])
        concat = trans + f"concat=n={len(images)}:v=1:a=0,format=yuv420p[v]"
        filter_str = ";".join(filter_parts) + ";" + concat
        filter_str += ";[v]drawtext=text='@geoleadsextrator':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h-th-30:shadowcolor=black:shadowx=2:shadowy=2[v]"
        cmd = ["ffmpeg", "-y"] + inputs + [
            "-filter_complex", filter_str,
            "-map", "[v]",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "28",
            "-shortest",
        ]
        if music:
            cmd += ["-map", str(len(images)), "-c:a", "aac", "-b:a", "128k"]
        cmd.append(output_path)
        subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            print(f"Video created: {output_path}")
            return output_path, t, text, tags
    except Exception as e:
        print(f"ffmpeg error: {e}")
    finally:
        for img in images:
            try: os.remove(img)
            except: pass
    return None, None, None, None


if __name__ == "__main__":
    out, t, text, tags = create_shorts_video()
    if out:
        print(f"Short created: {out}")
        desc = f"{text}\n\n🚀 GeoLeads - Extracao de Leads automatizada"
        vid = upload_to_youtube(out, t, desc, tags)
        if vid:
            print(f"Short uploaded: https://youtu.be/{vid}")
        try: os.remove(out)
        except: pass
    else:
        print("Failed to create short")