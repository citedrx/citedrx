// Tracking hub: a platform-agnostic click/conversion tracker (like RedTrack
// or Voluum, minus the dashboards) backed by D1 (binding DB, schema.sql).
//
//   ad click ─► lander (?utm_*&click_id=<platform macro>)
//            ─► /go/{offer}: logs the click under our own click ID, sends it
//               to the affiliate network as aff_sub5, and reports a
//               "clickout" event to the ad platform
//   network conversion ─► /pb?key=..&cid={aff_sub5}&payout=..&txn=..
//            ─► looks up the click, logs the conversion, and reports it to
//               whichever platform the click came from (platforms.js)
//
// Tracking must never break a redirect: every D1/postback failure is
// swallowed and recorded, and /go always redirects.

import platforms from "./platforms.js";

const MAX = 120;
const clip = (v) => (v ? String(v).slice(0, MAX) : null);
const now = () => Math.floor(Date.now() / 1000);
const REJECTED = new Set(["rejected", "declined", "reversed", "refunded", "chargeback", "invalid"]);

// Platform click ID: `click_id` from our URL templates, else the IDs some
// platforms append on their own.
const CLICK_ID_PARAMS = ["click_id", "fbclid", "gclid", "ttclid"];

export function newClickId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return "c" + Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
}

export function adContext(params) {
  return {
    source: clip((params.get("utm_source") || "").toLowerCase()) || "direct",
    campaign: clip(params.get("utm_campaign")),
    adset: clip(params.get("utm_term")),
    ad: clip(params.get("utm_content")),
    page: clip(params.get("page")),
    placement: clip(params.get("pl")),
    platformClickId: clip(CLICK_ID_PARAMS.map((k) => params.get(k)).find(Boolean)),
  };
}

// Sends one event to the platform a click came from. Returns a short status
// string for the log; never throws.
export async function notifyPlatform(source, platformClickId, eventKey, value) {
  const platform = platforms[source];
  if (!platform) return "no-platform";
  const event = platform.events && platform.events[eventKey];
  if (!event) return "event-off";
  if (!platform.postback) return "no-postback";
  if (!platformClickId) return "no-click-id";
  try {
    const res = await fetch(platform.postback(platformClickId, event, value), { method: "GET" });
    return "sent:" + res.status;
  } catch (e) {
    return "error";
  }
}

export async function recordClick(env, click) {
  const status = await notifyPlatform(click.source, click.platformClickId, "clickout");
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `INSERT INTO clicks (id, ts, source, platform_click_id, campaign, adset, ad, page, placement, offer, country, clickout_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(click.id, now(), click.source, click.platformClickId, click.campaign, click.adset, click.ad,
        click.page, click.placement, click.offer, click.country, status)
      .run();
  } catch (e) {
    console.error("recordClick", e);
  }
}

export async function recordView(env, params, country) {
  if (!env.DB) return;
  const c = adContext(params);
  try {
    await env.DB.prepare(`INSERT INTO views (ts, source, campaign, adset, ad, page, country) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(now(), c.source, c.campaign, c.adset, c.ad, c.page, country)
      .run();
  } catch (e) {
    console.error("recordView", e);
  }
}

function authorized(env, params) {
  return Boolean(env.TRACKING_KEY) && params.get("key") === env.TRACKING_KEY;
}

const text = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain", "X-Robots-Tag": "noindex" } });

// Affiliate-network conversion postback. Expected query params:
//   key     shared secret (env.TRACKING_KEY)
//   cid     our click ID, i.e. the network's aff_sub5 macro
//   payout  commission for this conversion
//   txn     network transaction ID (dedupes repeated postbacks)
//   status  optional; rejected/reversed conversions are logged, not reported
export async function handlePostback(env, params) {
  if (!env.TRACKING_KEY) return text("tracking key not configured", 503);
  if (!authorized(env, params)) return text("forbidden", 403);

  const cid = clip(params.get("cid"));
  if (!cid) return text("missing cid", 400);
  const payout = Number.parseFloat(params.get("payout")) || 0;
  const status = clip((params.get("status") || "").toLowerCase());
  const txn = clip(params.get("txn")) || cid;

  if (!env.DB) return text("db not configured", 503);
  const click = await env.DB.prepare(`SELECT source, platform_click_id, offer FROM clicks WHERE id = ?`).bind(cid).first();

  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO conversions (txn_id, ts, click_id, offer, payout, status) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(txn, now(), cid, click ? click.offer : null, payout, status)
    .run();
  if (!inserted.meta || inserted.meta.changes === 0) return text("duplicate");

  let forward = "unknown-click";
  if (click) {
    forward = REJECTED.has(status)
      ? "skipped:" + status
      : await notifyPlatform(click.source, click.platform_click_id, "conversion", payout || null);
  }
  await env.DB.prepare(`UPDATE conversions SET forward_status = ? WHERE txn_id = ?`).bind(forward, txn).run();
  return text("ok " + forward);
}

// ---- Report: /report?key=..&days=7 ----

const DIMENSIONS = [
  ["source", "Traffic source"],
  ["campaign", "Campaign"],
  ["adset", "Ad set / site"],
  ["ad", "Ad / creative"],
  ["page", "Lander"],
  ["offer", "Offer"],
  ["placement", "Button placement"],
];
const VIEW_DIMS = new Set(["source", "campaign", "adset", "ad", "page"]);

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + "%" : "–");
const money = (n) => "$" + (n || 0).toFixed(2);

async function breakdown(db, dim, since) {
  const rows = new Map();
  const row = (k) => {
    const key = k ?? "(none)";
    if (!rows.has(key)) rows.set(key, { key, views: 0, clicks: 0, convs: 0, revenue: 0 });
    return rows.get(key);
  };
  if (VIEW_DIMS.has(dim)) {
    const v = await db.prepare(`SELECT ${dim} AS k, COUNT(*) AS n FROM views WHERE ts >= ? GROUP BY ${dim}`).bind(since).all();
    v.results.forEach((r) => (row(r.k).views = r.n));
  }
  const c = await db.prepare(`SELECT ${dim} AS k, COUNT(*) AS n FROM clicks WHERE ts >= ? GROUP BY ${dim}`).bind(since).all();
  c.results.forEach((r) => (row(r.k).clicks = r.n));
  const cv = await db
    .prepare(
      `SELECT k.${dim} AS k, COUNT(*) AS n, SUM(v.payout) AS rev FROM conversions v JOIN clicks k ON k.id = v.click_id
       WHERE v.ts >= ? AND (v.status IS NULL OR v.status NOT IN (${[...REJECTED].map(() => "?").join(",")}))
       GROUP BY k.${dim}`
    )
    .bind(since, ...REJECTED)
    .all();
  cv.results.forEach((r) => {
    const x = row(r.k);
    x.convs = r.n;
    x.revenue = r.rev || 0;
  });
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue || b.clicks - a.clicks || b.views - a.views);
}

export async function handleReport(env, params) {
  if (!authorized(env, params)) return text("forbidden", 403);
  if (!env.DB) return text("db not configured", 503);
  const days = Math.min(Math.max(Number.parseInt(params.get("days"), 10) || 7, 1), 90);
  const since = now() - days * 86400;

  let html = "";
  for (const [dim, label] of DIMENSIONS) {
    const rows = await breakdown(env.DB, dim, since);
    if (!rows.length) continue;
    const hasViews = VIEW_DIMS.has(dim);
    html += `<h2>${label}</h2><div class="scroll"><table><tr><th>${label}</th>${hasViews ? "<th>Lander views</th>" : ""}<th>Offer clicks</th>${hasViews ? "<th>Lander CTR</th>" : ""}<th>Conversions</th><th>Conv. rate</th><th>Revenue</th><th>EPC</th></tr>`;
    for (const r of rows) {
      html += `<tr><td>${esc(r.key)}</td>${hasViews ? `<td>${r.views}</td>` : ""}<td>${r.clicks}</td>${hasViews ? `<td>${pct(r.clicks, r.views)}</td>` : ""}<td>${r.convs}</td><td>${pct(r.convs, r.clicks)}</td><td>${money(r.revenue)}</td><td>${money(r.clicks ? r.revenue / r.clicks : 0)}</td></tr>`;
    }
    html += "</table></div>";
  }

  const recent = await env.DB.prepare(
    `SELECT v.ts, v.offer, v.payout, v.status, v.forward_status, k.source, k.campaign, k.ad
     FROM conversions v LEFT JOIN clicks k ON k.id = v.click_id ORDER BY v.ts DESC LIMIT 25`
  ).all();
  if (recent.results.length) {
    html += `<h2>Latest conversions</h2><div class="scroll"><table><tr><th>Time (UTC)</th><th>Source</th><th>Campaign</th><th>Ad</th><th>Offer</th><th>Payout</th><th>Status</th><th>Sent to platform</th></tr>`;
    for (const r of recent.results) {
      html += `<tr><td>${new Date(r.ts * 1000).toISOString().slice(0, 16).replace("T", " ")}</td><td>${esc(r.source)}</td><td>${esc(r.campaign)}</td><td>${esc(r.ad)}</td><td>${esc(r.offer)}</td><td>${money(r.payout)}</td><td>${esc(r.status)}</td><td>${esc(r.forward_status)}</td></tr>`;
    }
    html += "</table></div>";
  }

  const key = esc(params.get("key"));
  const ranges = [1, 7, 30, 90].map((d) => (d === days ? `<b>${d}d</b>` : `<a href="?key=${key}&days=${d}">${d}d</a>`)).join(" · ");
  const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Tracking report</title>
<style>body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;margin:0 auto;padding:16px;max-width:1100px;color:#15171a;background:#fff}h1{font-size:20px}h2{font-size:16px;margin:28px 0 8px}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:560px}th,td{text-align:right;padding:6px 8px;border-bottom:1px solid #e3e5e8;white-space:nowrap}th:first-child,td:first-child{text-align:left;white-space:normal}th{background:#f6f7f8}.note{color:#767d86}</style>
</head><body><h1>Tracking report: last ${days} day${days > 1 ? "s" : ""}</h1><p>${ranges}</p>
<p class="note">EPC = revenue per offer click. Compare with each platform's CPC and spend to get profit; this log doesn't see ad spend.</p>
${html || "<p>No data yet.</p>"}</body></html>`;
  return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex", "Cache-Control": "no-store" } });
}
