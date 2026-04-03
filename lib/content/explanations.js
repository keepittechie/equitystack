export const EXPLANATION_CONTENT = Object.freeze({
  promiseRecord: {
    build:
      "Promise Tracker separates the public record into the original promise, the actions that followed, the outcomes that were documented, and the evidence linked to those outcomes.",
    interpretReady:
      "This record currently has enough visible outcome and source detail to support public scoring.",
    interpretPending:
      "This record remains visible even if it is not yet scoring-ready, so readers can inspect the public record before editorial enrichment is complete.",
    verify: [
      "Read the original promise text.",
      "Review the linked actions and documented outcomes.",
      "Check the supporting source trail attached to those actions and outcomes.",
    ],
  },
  promisePresident: {
    build:
      "This presidency view groups curated Promise Tracker records by status and keeps the underlying record counts, outcomes, and source references visible.",
    interpret:
      "Records remain visible here even before they are complete enough for scoring. Open Black Impact Score when you want the summarized score view, then return to these record pages to verify the underlying actions, outcomes, and sources.",
    verify: [
      "Open a Promise Tracker record from the list.",
      "Review the actions and documented outcomes attached to that record.",
      "Use Black Impact Score only as a rollup of the same public evidence base.",
    ],
  },
  currentAdministration: {
    build:
      "Records are reviewed before they appear here, and the page is built from Promise Tracker actions, outcomes, and linked public sources.",
    interpret:
      "Positive means helped. Negative means harmed. Mixed means both. Blocked means the attempt did not fully take effect.",
    verify: [
      "Open an individual record.",
      "Check the linked actions and documented outcomes.",
      "Review the source trail before treating a summary as final.",
    ],
  },
  policyRecord: {
    build:
      "This policy page combines structured scoring, historical evidence, source quality, and measurable outcomes into one record view.",
    interpret:
      "Use the impact reading, evidence base, and record completeness together. A higher score is not enough by itself without source-backed context.",
    verify: [
      "Review the summary and outcome sections.",
      "Inspect the linked sources and metrics.",
      "Check related policies and explainers before drawing a broader conclusion.",
    ],
  },
  blackImpactScore: {
    build:
      "This public view rolls up curated Promise Tracker records into a president-level report. Only outcomes with written summaries, impact direction, and linked sources are scored numerically, while the underlying source trail remains visible on each Promise Tracker page.",
    interpret:
      "This report scores documented outcomes, not campaign language alone. Evidence strength changes numeric weighting, while mixed and blocked outcomes stay visible but are treated conservatively as neutral in this MVP.",
    verify: [
      "Review the linked Promise Tracker record.",
      "Check the documented outcomes attached to that record.",
      "Review the supporting sources on the record page.",
      "Compare the record against the methodology section.",
    ],
  },
});
