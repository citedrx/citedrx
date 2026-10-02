# trending.citedrx.com — paid-traffic landers ("Trending Health")

A separate Cloudflare Worker from the main citedrx.com site (repo root), so ad
landers never share pages, assets, or indexing with the organic site. Every
response is `noindex` (`public/_headers` + `<meta name="robots">`), and nothing
on citedrx.com links here.

## URL structure

| Path | Purpose |
|---|---|
| `/{vertical}/{angle}/` | Landers, e.g. `/weight-loss/glp1-insurance/`. Angle slugs stay brand-neutral so the featured offer can be swapped without changing a live ad URL. |
| `/go/{offer}` | Outbound redirect to the affiliate link in `src/offers.js`. Pages never link to raw tracking URLs. |
| `/`, `/disclosure/`, `/privacy/` | Hub + compliance pages ad reviewers look for. |

Live pages:
- `/weight-loss/glp1-insurance/`: launch advertorial (featured: Found)
- `/weight-loss/compare-glp1-programs/`: comparison chart (Found #1, Pallas, HealthRx)

## Ad URL parameters

Send traffic as:

    https://trending.citedrx.com/weight-loss/glp1-insurance/?utm_source=newsbreak&utm_campaign={campaign}&utm_content={ad}&click_id={click id macro}

Replace the `{...}` values with the ad platform's macros. `public/assets/t.js` copies these
onto every `/go/` link (and keeps them for the session), and the Worker
forwards them to Katalys:

| Landing param | Katalys param |
|---|---|
| `utm_source` | `source` |
| `utm_campaign` | `aff_sub` |
| `utm_content` | `aff_sub2` |
| page slug (`data-page` on `<body>`) | `aff_sub3` |
| link placement (`data-pl`) | `aff_sub4` |
| `click_id` | `aff_sub5` |

Use `aff_sub5` in a Katalys postback to send conversions back to the ad network.

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
