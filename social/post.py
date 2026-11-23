#!/usr/bin/env python3
"""Post the next queued CitedRx social update to Facebook + Instagram.

Picks the oldest queue.json entry with post_status == "ready", posts its
already-deployed image (public/social/img/<id>.jpg on citedrx.com) and
caption to the Facebook Page and the linked Instagram Business account via
the Meta Graph API, then marks the entry "posted" in queue.json.

Credentials: the Meta Page Access Token is never read from this repo. It is
expected to be injected by the environment's network proxy into the
Authorization header of outbound requests to graph.facebook.com (set up via
request_credential). This script sends a placeholder Bearer value; the
proxy replaces it in flight.

Non-secret IDs (Page ID, Instagram Business Account ID) live in
social/config.json.

Usage:
  python3 post.py                 # post the next ready item for real
  python3 post.py --dry-run       # show what would be posted, no API calls
  python3 post.py --id <post-id>  # force a specific queue entry
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

GRAPH_API_VERSION = "v21.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"
SOCIAL_DIR = Path(__file__).resolve().parent
QUEUE_PATH = SOCIAL_DIR / "queue.json"
CONFIG_PATH = SOCIAL_DIR / "config.json"
IMAGE_BASE_URL = "https://citedrx.com/social/img"

# Placeholder only — the environment's network proxy replaces this with the
# real long-lived Page Access Token for requests to graph.facebook.com.
PLACEHOLDER_TOKEN = "proxy-injected"


def load_json(path):
    if not path.exists():
        print(f"Missing {path}. See social/README.md.", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def graph_request(path, params, method="POST", access_token=None):
    """Call the Graph API.

    With no access_token, sends the placeholder Bearer header the proxy
    replaces with the System User token (used only to look up the Page's
    own access token). Publishing calls must instead pass the Page access
    token explicitly as a query/body parameter: Facebook requires posts to
    be made "as the page", which the System User token alone can't do, and
    passing it via the Authorization header would just get overwritten
    again by the proxy's injected System User credential.
    """
    url = f"{GRAPH_BASE}/{path}"
    if access_token:
        params = {**params, "access_token": access_token}
    if method == "POST":
        data = urllib.parse.urlencode(params).encode()
        req = urllib.request.Request(url, data=data, method=method)
    else:
        url = f"{url}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, method=method)
    if not access_token:
        req.add_header("Authorization", f"Bearer {PLACEHOLDER_TOKEN}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Graph API error on {path}: {e.code} {body}", file=sys.stderr)
        raise


def get_page_access_token(page_id):
    result = graph_request(f"{page_id}", {"fields": "access_token"}, method="GET")
    return result["access_token"]


def wait_for_container_ready(creation_id, access_token, timeout=60, interval=3):
    """Poll an Instagram media container until Meta finishes processing it.

    media_publish can 400 with "Media ID is not available" if called before
    Meta finishes fetching/transcoding the image; status_code moves from
    IN_PROGRESS to FINISHED (or ERROR) with no documented fixed delay.
    """
    waited = 0
    while waited <= timeout:
        status = graph_request(
            f"{creation_id}", {"fields": "status_code"}, method="GET", access_token=access_token
        )
        code = status.get("status_code")
        if code == "FINISHED":
            return
        if code == "ERROR":
            raise RuntimeError(f"Instagram container {creation_id} failed processing: {status}")
        time.sleep(interval)
        waited += interval
    raise TimeoutError(f"Instagram container {creation_id} not ready after {timeout}s")


def pick_post(queue, forced_id=None):
    posts = queue["posts"]
    if forced_id:
        for p in posts:
            if p["id"] == forced_id:
                return p
        print(f"No queue entry with id {forced_id}", file=sys.stderr)
        sys.exit(1)
    ready = [p for p in posts if p.get("post_status") == "ready"]
    if not ready:
        print("No queue entries with post_status 'ready'. Nothing to post.")
        sys.exit(0)
    ready.sort(key=lambda p: p.get("scheduled_for", ""))
    return ready[0]


def build_captions(post):
    base = post["caption_base"]
    hashtags = post.get("hashtags_ig", "")
    caption_fb = base
    caption_ig = f"{base}\n\n{hashtags}".strip()
    return caption_fb, caption_ig


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print the plan, make no API calls")
    parser.add_argument("--id", dest="forced_id", help="Force a specific queue entry id")
    args = parser.parse_args()

    queue = load_json(QUEUE_PATH)
    config = load_json(CONFIG_PATH)
    page_id = config["page_id"]
    ig_user_id = config["instagram_business_account_id"]

    post = pick_post(queue, args.forced_id)
    image_url = f"{IMAGE_BASE_URL}/{post['id']}.jpg"
    caption_fb, caption_ig = build_captions(post)

    print(f"Post: {post['id']}  (pillar: {post.get('pillar')})")
    print(f"Image URL: {image_url}")
    print(f"--- Facebook caption ---\n{caption_fb}\n")
    print(f"--- Instagram caption ---\n{caption_ig}\n")

    if args.dry_run:
        print("(dry run: no API calls made)")
        return

    if post.get("image_status") != "deployed":
        print(
            f"Refusing to post: image_status is '{post.get('image_status')}', expected 'deployed'. "
            "Generate and deploy the image to public/social/img/ first.",
            file=sys.stderr,
        )
        sys.exit(1)

    page_token = get_page_access_token(page_id)

    fb_post_id = post.get("fb_post_id")
    if fb_post_id:
        print(f"Facebook already posted (from a previous run): {fb_post_id}")
    else:
        fb_result = graph_request(
            f"{page_id}/photos",
            {"url": image_url, "caption": caption_fb, "published": "true"},
            access_token=page_token,
        )
        fb_post_id = fb_result.get("post_id") or fb_result.get("id")
        print(f"Facebook post published: {fb_post_id}")
        # Persist immediately: if Instagram fails below, a retry must not
        # re-post to Facebook.
        post["fb_post_id"] = fb_post_id
        save_json(QUEUE_PATH, queue)

    container = graph_request(
        f"{ig_user_id}/media",
        {"image_url": image_url, "caption": caption_ig},
        access_token=page_token,
    )
    creation_id = container["id"]
    wait_for_container_ready(creation_id, page_token)
    publish_result = graph_request(
        f"{ig_user_id}/media_publish",
        {"creation_id": creation_id},
        access_token=page_token,
    )
    ig_media_id = publish_result["id"]
    print(f"Instagram post published: {ig_media_id}")

    post["post_status"] = "posted"
    post["ig_media_id"] = ig_media_id
    post["posted_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    save_json(QUEUE_PATH, queue)
    print("queue.json updated.")


if __name__ == "__main__":
    main()
