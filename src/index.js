import { handleWeightLossMatch } from "./agent/weight-loss-match.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let changed = false;

    if (url.hostname === "www.citedrx.com") {
      url.hostname = "citedrx.com";
      changed = true;
    }
    if (url.protocol === "http:") {
      url.protocol = "https:";
      changed = true;
    }

    if (changed) {
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/weight-loss-match") {
      return handleWeightLossMatch(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
