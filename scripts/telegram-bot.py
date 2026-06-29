import requests, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bot_utils import generate_varied_content, generate_post_image, save_image_to_file

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CID = os.environ.get("TELEGRAM_CHANNEL_ID", "")
APP_URL = os.environ.get("APP_URL") or os.environ.get("NEXT_PUBLIC_APP_URL") or "https://geoleads-production.up.railway.app"

def send(text, photo=None):
    p = {"chat_id": CID, "text": text, "parse_mode": "HTML"}
    if photo and os.path.exists(photo):
        with open(photo, "rb") as fp:
            return requests.post(f"https://api.telegram.org/bot{TOKEN}/sendPhoto", params=p, files={"photo": fp}).json()
    return requests.post(f"https://api.telegram.org/bot{TOKEN}/sendMessage", json=p).json()

if __name__ == "__main__":
    if not TOKEN or not CID:
        print("ERROR: TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID required")
        exit(1)
    c = generate_varied_content()
    if not c: print("No content"); exit(1)
    t, text, ip, tags = c
    full = f"<b>{t}</b>\n\n{text}\n\n<a href='{APP_URL}/login'>🚀 Teste o GeoLeads gratis</a>"
    img = generate_post_image(ip or "digital marketing")
    p = save_image_to_file(img, "tg") if img else None
    result = send(full, p)
    print(json.dumps(result, indent=2)[:300])