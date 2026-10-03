# trending.citedrx.com — paid-traffic landers ("Trending Health")

A separate Cloudflare Worker from the main citedrx.com site (repo root), so ad
landers never share pages, assets, or indexing with the organic site. Every
response is `noindex` (`public/_headers` + `<meta name="robots">`), and nothing
on citedrx.com links here.

## URL structure

| Path | Purpose |
|---|---|
| `/{vertical}/{angle}/` | Landers, e.g. `/weight-loss/glp1-insurance/`. Angle slugs stay brand-neutral so the featured offer can be swapped without changing a live ad URL. |
| `/go/{offer}` | Outbound redirect to the affiliate link in `src/offers.js`, with click tracking. Pages never link to raw tracking URLs. |
| `/pb`, `/v`, `/report` | Conversion postback, lander-view beacon, tracking report (see below). |
| `/`, `/disclosure/`, `/privacy/` | Hub + compliance pages ad reviewers look for. |

Live pages:
- `/weight-loss/glp1-insurance/`: launch advertorial (featured: Found)
- `/weight-loss/compare-glp1-programs/`: comparison chart (Found #1, Pallas, HealthRx)

## Conversion tracking (all ad platforms)

The Worker is a small click tracker (like RedTrack/Voluum) backed by the D1
database `trending-tracking` (schema: `schema.sql`):

```
ad click -> lander ?utm_*&click_id=<platform macro>        (t.js keeps these for the session,
                                                          and sends a view beacon to /v)
         -> /go/{offer}  logs the click under our own click ID (cid),
                         redirects to Katalys with aff_sub5=cid,
                         reports a "clickout" event to the ad platform
sale     -> Katalys postback -> /pb?cid={aff_sub5}&payout=..  looks up the click and
                         reports the conversion (with payout) to the platform it came from
```

### 1. Ad destination URLs

Lander URL + the platform's template from `src/platforms.js`, e.g. NewsBreak:

    https://trending.citedrx.com/weight-loss/glp1-insurance/?utm_source=newsbreak&utm_campaign=__CAMPAIGN_NAME__&utm_term=__FLIGHT_NAME__&utm_content=__CREATIVE_NAME__&click_id=__CALLBACK_PARAM__

Templates exist for newsbreak, taboola, outbrain, and mgid. Meta, Google, and
TikTok append their own click IDs (fbclid/gclid/ttclid), which are logged,
but reporting conversions back to them needs their API tokens (not built yet).

### 2. Katalys postback (one global postback covers every platform)

    https://trending.citedrx.com/pb?key=TRACKING_KEY&cid={aff_sub5}&payout={payout}&txn={transaction_id}&status={status}

Use Katalys's own macro names for aff_sub5 / payout / transaction ID / status.
`TRACKING_KEY` is a Worker secret (Cloudflare dashboard > citedrx-trending >
Settings > Variables and secrets). Payouts are earned on approval: a
`pending` postback is logged but held back from the ad platform until a later
postback for the same `txn` approves it. Rejected/reversed conversions are
logged and never reported, a sale is never reported twice, and report revenue
counts only approved (or unlabeled) conversions.

### 3. Platform conversion events

Each platform gets two events (names in `src/platforms.js`):
`clickout` (reader clicked through to an offer) and `conversion` (sale, with
payout). Taboola, Outbrain, and MGID require those event names to be created
in their ads manager first.

### 4. Report

    https://trending.citedrx.com/report?key=TRACKING_KEY&days=7

Lander views, offer clicks, lander CTR, conversions, revenue, and EPC by
source, campaign, ad set, ad, lander, offer, and button placement, plus the
latest conversions and whether each reached its platform.

### Katalys sub-IDs (also visible in Katalys's own reports)

| Katalys param | Value |
|---|---|
| `source` | utm_source |
| `aff_sub` | utm_campaign |
| `aff_sub2` | utm_content (ad) |
| `aff_sub3` | lander (`data-page` on `<body>`) |
| `aff_sub4` | button placement (`data-pl`) |
| `aff_sub5` | our click ID (must come back in the postback) |

### Adding an ad platform

Add an entry to `src/platforms.js` (URL template + postback URL builder), set
`utm_source` in its template to the entry's key, and create its events in the
platform's ads manager.

## Adding an offer or vertical

1. Add the offer to `src/offers.js` (slug -> tracking URL). `active: false`
   pauses it; `/go/` then uses `fallback` or the homepage.
2. Create `public/{vertical}/{angle}/index.html` from an existing lander, link
   CTAs as `/go/{slug}` with a `data-pl="placement"` attribute, and set a
   unique `data-page` on `<body>`.
3. Add it to `public/index.html`.

## Copy rules (keep landers approvable)

- "Advertisement" strip at the top, sponsor named, disclosure in the footer.
- No invented testimonials, people, before/after photos, countdown timers,
  fake news mastheads, or results claims beyond cited trial averages.
- Never say or imply a compounded drug is the same as, or FDA-approved like, a
  brand-name drug.
- Prices = the provider's published price, with an "as of" date. Re-check
  before every campaign launch.

## Deploy

`npx wrangler deploy` from this directory, or connect a Cloudflare Workers
Build to this repo with **root directory `trending`**. `wrangler.toml` attaches
`trending.citedrx.com` as a custom domain (the zone must be on the same
Cloudflare account).
