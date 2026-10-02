// trending.citedrx.com: paid-traffic (NewsBreak / native / social) landers.
//
// Static pages in ./public are served directly by Workers Static Assets
// (public/_headers marks every one noindex), so this code only runs for
// paths with no matching file. Its one real job is /go/{offer}: every
// outbound CTA links there instead of to a raw tracking URL, and the
// redirect forwards ad-click context to the affiliate network as sub-IDs.

import offers from "./offers.js";

const NOINDEX = "noindex, nofollow, noarchive";

// Click-through query params -> Katalys (TUNE/HasOffers) sub-ID params, so
// conversions can be split by traffic source, campaign, ad, page, and
// on-page placement, and click_id can be posted back to the ad network.
// public/assets/t.js copies the landing page's params onto every /go link.
export const SUB_ID_MAP = {
  utm_source: "source",
  utm_campaign: "aff_sub",
  utm_content: "aff_sub2",
  page: "aff_sub3",
  pl: "aff_sub4",
  click_id: "aff_sub5",
};

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", "X-Robots-Tag": NOINDEX },
  });
}

export function resolveOffer(slug) {
  let offer = offers[slug];
  if (offer && !offer.active && offer.fallback) offer = offers[offer.fallback];
  return offer && offer.active ? offer : null;
}

export function buildOutboundUrl(offer, params) {
  const dest = new URL(offer.url);
  for (const [from, to] of Object.entries(SUB_ID_MAP)) {
    const value = params.get(from);
    if (value) dest.searchParams.set(to, value.slice(0, 100));
  }
  return dest.toString();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    const go = url.pathname.match(/^\/go\/([a-z0-9-]+)\/?$/);
    if (go) {
      const offer = resolveOffer(go[1]);
      // A paused or unknown offer sends the click to the homepage rather
      // than an error, so a live ad never dead-ends.
      return redirect(offer ? buildOutboundUrl(offer, url.searchParams) : "/");
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", NOINDEX);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
