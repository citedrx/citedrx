-- D1 schema for the trending.citedrx.com click + conversion log
-- (database: trending-tracking, binding: DB). Safe to re-run.

-- One row per outbound CTA click (/go/{offer}). `id` is our own click ID,
-- sent to the affiliate network as aff_sub5 and returned in its postback.
CREATE TABLE IF NOT EXISTS clicks (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,              -- unix seconds
  source TEXT,                      -- utm_source: newsbreak, taboola, ...
  platform_click_id TEXT,           -- the ad platform's own click ID
  campaign TEXT,                    -- utm_campaign
  adset TEXT,                       -- utm_term
  ad TEXT,                          -- utm_content
  page TEXT,                        -- lander slug
  placement TEXT,                   -- which button (data-pl)
  offer TEXT,                       -- offers.js slug
  country TEXT,
  clickout_status TEXT              -- result of the clickout postback to the platform
);
CREATE INDEX IF NOT EXISTS clicks_ts ON clicks (ts);
CREATE INDEX IF NOT EXISTS clicks_source_ts ON clicks (source, ts);

-- One row per affiliate-network conversion postback (/pb).
CREATE TABLE IF NOT EXISTS conversions (
  txn_id TEXT PRIMARY KEY,          -- network transaction ID: dedupes repeat postbacks
  ts INTEGER NOT NULL,
  click_id TEXT,                    -- clicks.id
  offer TEXT,
  payout REAL,
  status TEXT,                      -- network status if sent (approved, pending, ...)
  forward_status TEXT               -- result of the conversion postback to the platform
);
CREATE INDEX IF NOT EXISTS conversions_ts ON conversions (ts);
CREATE INDEX IF NOT EXISTS conversions_click ON conversions (click_id);

-- One row per lander page view (beacon from public/assets/t.js), so the
-- report can show lander click-through rate (views -> offer clicks).
CREATE TABLE IF NOT EXISTS views (
  ts INTEGER NOT NULL,
  source TEXT,
  campaign TEXT,
  adset TEXT,
  ad TEXT,
  page TEXT,
  country TEXT
);
CREATE INDEX IF NOT EXISTS views_ts ON views (ts);
