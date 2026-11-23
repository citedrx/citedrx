# CitedRx social content pipeline

Automates static informational posts to the CitedRx Facebook Page and linked Instagram Business account.

## How it works

1. **`queue.json`** holds the content calendar. Each entry is one post: a short on-image headline/subhead, a caption, hashtags for Instagram, and the real CitedRx page it's drawn from (`source_url`). Every claim in a caption must trace back to that page — nothing here should be invented.
2. **Image generation** (manual step today, via Canva): each queued post's `image_headline`/`image_subhead` gets merged into the CitedRx branded template, exported, and saved to `public/social/img/<id>.jpg` so it has a stable public HTTPS URL once deployed (Meta's API needs a real URL, not a file upload, for Instagram).
3. **`post.py`** picks the oldest entry with `post_status: "ready"`, posts the image + caption to the Facebook Page (`/{page_id}/photos`) and the Instagram Business account (`/{ig_user_id}/media` → `/{ig_user_id}/media_publish`), then flips `post_status` to `"posted"` and records the resulting post IDs.
4. A recurring scheduled task (set up separately, not committed here) fires `post.py` on the chosen cadence.

## Status values

- `image_status`: `pending` → `generated` (file exists under `public/social/img/`) → `deployed` (live on citedrx.com, so Meta can fetch it)
- `post_status`: `draft` (copy not yet approved) → `ready` (approved, image deployed, waiting for its scheduled run) → `posted` (live on both platforms) / `skipped`

## Adding a new post

Append an entry to `queue.json` with a unique `id` (date-prefixed), pick a `pillar`, and cite a real `source_url`. Current pillars:

- `mythbust` — corrects a common misconception using evidence already on the site
- `trust_methodology` — explains how/why CitedRx scores, especially where it doesn't favor a sponsor
- `provider_spotlight` — highlights one provider's real score and why
- `safety_psa` — surfaces a real, sourced regulatory/legal disclosure (FDA warning letter, FTC lawsuit, etc.)
- `explainer` — plain-language answer to a real search query pattern
- `comparison_teaser` — teases a head-to-head comparison already on the site
- `news_reaction` — connects a real, independently-verifiable news event to CitedRx's own already-published, sourced data on the topic (never the other way around: the CitedRx-specific claims must trace to source_url, not to the news item itself)

## Credentials

`post.py` expects a Meta long-lived Page Access Token with `pages_manage_posts`, `instagram_basic`, and `instagram_content_publish` scopes, plus the Page ID and Instagram Business Account ID. The token is stored as a network credential for `graph.facebook.com`, never committed to this repo. IDs live in `social/config.json` (not committed if it ever holds anything sensitive — Page/IG IDs aren't secret, but the token never goes in any file here).
