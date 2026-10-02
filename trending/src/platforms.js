// Ad platforms (traffic sources) the tracking hub can report conversions to.
// The key must match the utm_source in that platform's ad URL template.
//
// To add a platform:
//   1. Add an entry here: its URL template (macros the platform fills in on
//      each click) and a postback() that builds its server-to-server
//      conversion URL.
//   2. Use the template as the query string on every ad's destination URL.
//   3. Create the event names below as conversion events in the platform's
//      ads manager where it requires that (Taboola, Outbrain, MGID).
//
// Every template passes the platform's click ID as `click_id`, so the
// lander script and the Worker need no per-platform code. A platform with
// no postback() (e.g. one that needs an API token) still gets every click
// and conversion logged; only the report back to the platform is skipped.
//
// events.clickout fires when a reader clicks through to an offer (fast,
// high-volume signal for early optimization). events.conversion fires on a
// confirmed affiliate sale, with the payout as its value. Set either to
// null to stop sending it.

const enc = encodeURIComponent;

export default {
  newsbreak: {
    label: "NewsBreak",
    urlTemplate:
      "utm_source=newsbreak&utm_campaign=__CAMPAIGN_NAME__&utm_term=__FLIGHT_NAME__&utm_content=__CREATIVE_NAME__&click_id=__CALLBACK_PARAM__",
    events: { clickout: "initiate_checkout", conversion: "complete_payment" },
    postback: (clickId, event, value) =>
      `https://business.newsbreak.com/tracking/attribute?callback=${enc(clickId)}&event_type=${enc(event)}` +
      (value ? `&nb_value=${value}` : ""),
  },

  taboola: {
    label: "Taboola",
    urlTemplate:
      "utm_source=taboola&utm_campaign={campaign_name}&utm_term={site}&utm_content={campaign_item_id}&click_id={click_id}",
    events: { clickout: "clickout", conversion: "purchase" },
    postback: (clickId, event, value) =>
      `https://trc.taboola.com/actions-handler/log/3/s2s-action?click-id=${enc(clickId)}&name=${enc(event)}` +
      (value ? `&revenue=${value}&currency=USD` : ""),
  },

  outbrain: {
    label: "Outbrain",
    urlTemplate:
      "utm_source=outbrain&utm_campaign={{campaign_name}}&utm_term={{section_name}}&utm_content={{ad_title}}&click_id={{ob_click_id}}",
    events: { clickout: "clickout", conversion: "purchase" },
    postback: (clickId, event, value) =>
      `https://tr.outbrain.com/unifiedPixel?ob_click_id=${enc(clickId)}&name=${enc(event)}` +
      (value ? `&orderValue=${value}&currency=USD` : ""),
  },

  mgid: {
    label: "MGID",
    urlTemplate:
      "utm_source=mgid&utm_campaign={campaign_id}&utm_term={widget_id}&utm_content={teaser_id}&click_id={click_id}",
    // MGID goal identifiers are account-specific: copy the exact values for
    // each goal from MGID's postback settings before running MGID traffic.
    events: { clickout: "interest", conversion: "buy" },
    postback: (clickId, event, value) =>
      `https://a.mgid.com/postback?c=${enc(clickId)}&e=${enc(event)}` + (value ? `&r=${value}` : ""),
  },
};
