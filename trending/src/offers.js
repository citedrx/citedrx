// Affiliate offers for the trending.citedrx.com paid-traffic landers, across
// every vertical (weight loss, hair loss, ED, TRT, ...).
// Every outbound CTA on the subdomain links to /go/{slug}, never to the raw
// tracking URL, so swapping a link, pausing an offer, or adding sub-ID
// tracking happens here once instead of in every page.
//
// To add an offer (any vertical): add an entry keyed by a short slug, then
// link to it from a page as /go/{slug}?pl={placement}. Set `active: false`
// to pause an offer: its /go link then falls back to `fallback` (another
// slug) or the trending homepage, so live ads never land on a dead link.

export default {
  pallas: {
    brand: "Pallas Health",
    vertical: "weight-loss",
    network: "katalys",
    url: "https://track.revoffers.com/aff_c?offer_id=1622&aff_id=13569",
    active: true,
  },
  healthrx: {
    brand: "HealthRx",
    vertical: "weight-loss",
    network: "katalys",
    url: "https://track.revoffers.com/aff_c?offer_id=1630&aff_id=13569&url_id=12442",
    active: true,
  },
  found: {
    brand: "Found",
    vertical: "weight-loss",
    network: "katalys",
    url: "https://track.revoffers.com/aff_c?offer_id=1162&aff_id=13569&url_id=12126",
    active: true,
  },
};
