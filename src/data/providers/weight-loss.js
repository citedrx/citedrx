// Grounding data for the weight-loss AI matcher.
// Mirrors public/weight-loss/index.html exactly. Update both together.

export default {
  vertical: "weight-loss",
  label: "GLP-1 Weight Loss",
  topic: "GLP-1 weight-loss telehealth providers",
  comparisonUrl: "citedrx.com/weight-loss/",
  methodology: {
    scale: "0-10, 5 factors: Evidence Match (4 pts), Independent Rating (2 pts), Insurance & Support (2 pts), Clinical Support Model (1 pt), Regulatory Standing (1 pt).",
    note: "Evidence Match rewards branded-primary prescribing (the exact product tested in STEP/SURMOUNT/SELECT trials) over compounded, which is not individually FDA-reviewed. Score order is never adjusted for referral payment.",
    lastReviewed: "September 2026",
  },
  qualifyingQuestions: "budget/monthly price range, whether they have insurance they want to use, whether they specifically want FDA-approved branded medication vs are open to compounded, and whether coaching/behavioral support matters to them",
  providers: [
    { rank: 1, name: "Ro", score: 9.3, tier: "Branded-primary", bestFor: "Broadest branded medication selection + insurance coordination", price: "From $99/mo (compounded cash-pay tier)", priorAuth: true, independentRating: "4.4/5 (U.S. News)", url: "https://ro.co/", sponsored: false },
    { rank: 2, name: "LifeMD", score: 9.1, tier: "Branded-primary", bestFor: "Lowest-friction path to brand-name GLP-1s", price: "Varies by plan", priorAuth: true, independentRating: "4.0/5 (U.S. News)", url: "https://lifemd.com/", sponsored: false },
    { rank: 3, name: "WeightWatchers Clinic", score: 9.0, tier: "Branded-primary", bestFor: "Combining medication with structured nutrition coaching", price: "Varies by plan", priorAuth: true, independentRating: null, url: "https://www.weightwatchers.com/", sponsored: false },
    { rank: 4, name: "Found", score: 8.3, tier: "Mixed", bestFor: "Balancing insurance support with included coaching", price: "$49-$99/mo", priorAuth: true, independentRating: "4.6/5 (U.S. News)", url: "https://track.revoffers.com/aff_c?offer_id=1162&aff_id=13569&url_id=12126", sponsored: true, note: "CitedRx's sponsored referral partner. Offers both branded (Zepbound) and compounded semaglutide; ask which tier you'd be prescribed." },
    { rank: 5, name: "Noom Med", score: 7.2, tier: "Mixed", bestFor: "Psychology-based behavior change alongside medication", price: "$149-$209/mo", priorAuth: "Limited", independentRating: "4.3/5 (U.S. News)", url: "https://www.noom.com/", sponsored: false },
    { rank: 6, name: "Mochi Health", score: 6.5, tier: "Mixed", bestFor: "Quarterly clinical monitoring at a lower price", price: "$99/mo + membership", priorAuth: null, independentRating: null, url: "https://joinmochi.com/", sponsored: false },
    { rank: 7, name: "Calibrate", score: 5.3, tier: "Unconfirmed", bestFor: "Highest-touch, specialist-led care", price: "Varies by plan", priorAuth: null, independentRating: null, url: "https://www.joincalibrate.com/", sponsored: false },
    { rank: 8, name: "TrimRx", score: 5.0, tier: "Mixed", bestFor: "Choosing between compounded and brand-name in one place", price: "$174/mo", priorAuth: null, independentRating: null, url: "https://trimrx.com/", sponsored: false },
    { rank: 9, name: "Pallas Health", score: 5.0, tier: "Mixed", bestFor: "Bundled single price, no separate membership fee", price: "$199/mo", priorAuth: null, independentRating: null, url: "https://www.pallashealth.co/", sponsored: false },
    { rank: 10, name: "Medvi", score: 4.9, tier: "Mixed", bestFor: "Transparent cash-pay pricing", price: "$179 first mo", priorAuth: null, independentRating: null, url: "https://medvi-us.org/", sponsored: false, regulatoryNote: "FDA warning letter, February 2026, over labeling that implied it was the compounding pharmacy rather than a telehealth coordinator. Reflected in its score." },
    { rank: 11, name: "DirectMeds", score: 4.7, tier: "Compounded-primary", bestFor: "Large-scale, LegitScript-certified compounded access", price: "$249/mo", priorAuth: null, independentRating: null, url: "https://directmeds.com/", sponsored: false },
    { rank: 12, name: "AltRx", score: 4.5, tier: "Mixed", bestFor: "Full branded + compounded menu in one plan", price: "$89/mo", priorAuth: null, independentRating: null, url: "https://www.altrx.com/", sponsored: false, regulatoryNote: "Parent company Trinity Healthcare Supply received an FDA warning letter, June 2026, over website claims and labeling. Reflected in its score." },
    { rank: 13, name: "Embody", score: 3.8, tier: "Compounded-primary", bestFor: "Lowest advertised compounded price", price: "$69/mo", priorAuth: null, independentRating: null, url: "https://www.youembody.com/", sponsored: false },
    { rank: 14, name: "Trimi", score: 2.8, tier: "Compounded-primary", bestFor: "Simple flat-rate compounded pricing", price: "$99/mo", priorAuth: null, independentRating: null, url: "https://trytrimi.com/", sponsored: false },
    { rank: 15, name: "Henry Meds", score: 2.3, tier: "Compounded-primary", bestFor: "Fastest, lowest-friction intake", price: "$179/mo", priorAuth: null, independentRating: null, url: "https://henrymeds.com/", sponsored: false, regulatoryNote: "Active, unresolved litigation from Eli Lilly over compounded-tirzepatide marketing. Reflected in its score." },
  ],
};
