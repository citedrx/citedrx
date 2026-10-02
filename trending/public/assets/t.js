// Trending Health lander script (all pages, all verticals).
//  1. Carries ad-click params (utm_*, the platform click ID) from the landing
//     URL onto every /go/{offer} link, plus the page slug and the link's
//     placement, so the Worker can log the click and attribute conversions.
//  2. Sends a lander-view beacon (/v) for lander click-through reporting.
//  3. Fires a GA4 "clickout" event per outbound click.
//  4. Shows the sticky CTA bar once the reader is past the first screen.
(function () {
  // click_id comes from our per-platform URL templates (src/platforms.js);
  // fbclid/gclid/ttclid are appended by those platforms automatically.
  var PASS = ["utm_source", "utm_campaign", "utm_term", "utm_content", "click_id", "fbclid", "gclid", "ttclid"];
  var STORE = "th_click";

  // Persist for the session so a reader who moves from the advertorial to
  // the comparison chart keeps their original ad attribution.
  var saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(STORE) || "{}"); } catch (e) {}
  var qs = new URLSearchParams(location.search);
  var fresh = false;
  PASS.forEach(function (k) {
    var v = qs.get(k);
    if (v) { saved[k] = v; fresh = true; }
  });
  if (fresh) { try { sessionStorage.setItem(STORE, JSON.stringify(saved)); } catch (e) {} }

  var page = document.body.getAttribute("data-page") || location.pathname;

  try {
    var view = new URLSearchParams();
    PASS.forEach(function (k) { if (saved[k]) view.set(k, saved[k]); });
    view.set("page", page);
    navigator.sendBeacon("/v", view);
  } catch (e) {}

  document.querySelectorAll('a[href^="/go/"]').forEach(function (a) {
    var u = new URL(a.getAttribute("href"), location.origin);
    PASS.forEach(function (k) { if (saved[k]) u.searchParams.set(k, saved[k]); });
    u.searchParams.set("page", page);
    if (a.dataset.pl) u.searchParams.set("pl", a.dataset.pl);
    a.setAttribute("href", u.pathname + u.search);
    a.setAttribute("rel", "nofollow sponsored noopener");
  });

  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="/go/"]');
    if (!a || typeof gtag !== "function") return;
    gtag("event", "clickout", {
      offer: a.getAttribute("href").split("?")[0].replace("/go/", ""),
      placement: a.dataset.pl || "",
      page_path: location.pathname,
      transport_type: "beacon"
    });
  });

  var bar = document.querySelector(".sticky-cta");
  if (bar) {
    var onScroll = function () {
      var past = window.scrollY > window.innerHeight * 0.8;
      var nearEnd = window.innerHeight + window.scrollY > document.body.scrollHeight - 260;
      bar.classList.toggle("show", past && !nearEnd);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
