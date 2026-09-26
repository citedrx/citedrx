// Registry of matcher datasets by vertical slug (matches the site's URL structure,
// e.g. citedrx.com/weight-loss/ -> "weight-loss"). Add a new vertical by creating
// ./{slug}.js in this shape and registering it here; the /api/match/:vertical
// route and the generic agent handler need no other changes.

import weightLoss from "./weight-loss.js";

const registry = {
  "weight-loss": weightLoss,
};

export function getVerticalData(slug) {
  return registry[slug] || null;
}
