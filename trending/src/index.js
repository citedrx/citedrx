// trending.citedrx.com: paid-traffic (NewsBreak / native / social) landers.
//
// Static pages in ./public are served directly by Workers Static Assets
// (public/_headers marks every one noindex). This code runs only for the
// routes listed in wrangler.toml's run_worker_first:
//   /go/{offer}  outbound CTA redirect + click tracking
//   /pb          affiliate-network conversion postback
//   /v           lander view beacon
//   /report      tracking report
// See src/track.js for how tracking works and src/platforms.js to add an
// ad platform.

import offers from "./offers.js";
import { adContext, newClickId, recordClick, recordView, handlePostback, handleReport } from "./track.js";

const NOINDEX = "noindex, nofollow, noarchive";

// Ad context -> affiliate-network (Katalys / TUNE-style) sub-ID params, so
// the network's own reports split by source, campaign, ad, page, and
// placement. aff_sub5 carries our click ID, which the network must echo
// back in its conversion postback (see README).
export function subIds(ctx, clickId) {
  return {
    source: ctx.source,
    aff_sub: ctx.campaign,
    aff_sub2: ctx.ad,
    aff_sub3: ctx.page,
    aff_sub4: ctx.placement,
    aff_sub5: clickId,
  };
}

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

export function buildOutboundUrl(offer, subs) {
  const dest = new URL(offer.url);
  for (const [k, v] of Object.entries(subs)) {
    if (v) dest.searchParams.set(k, v);
  }
  return dest.toString();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    const country = (request.cf && request.cf.country) || null;

    const go = url.pathname.match(/^\/go\/([a-z0-9-]+)\/?$/);
    if (go) {
      const offer = resolveOffer(go[1]);
      // A paused or unknown offer sends the click to the homepage rather
      // than an error, so a live ad never dead-ends.
      if (!offer) return redirect("/");
      const adCtx = adContext(url.searchParams);
      const clickId = newClickId();
      ctx.waitUntil(recordClick(env, { ...adCtx, id: clickId, offer: go[1], country }));
      return redirect(buildOutboundUrl(offer, subIds(adCtx, clickId)));
    }

    if (url.pathname === "/pb") return handlePostback(env, url.searchParams);
    if (url.pathname === "/report") return handleReport(env, url.searchParams);

    if (url.pathname === "/v") {
      const params = request.method === "POST" ? new URLSearchParams(await request.text()) : url.searchParams;
      ctx.waitUntil(recordView(env, params, country));
      return new Response(null, { status: 204 });
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", NOINDEX);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
