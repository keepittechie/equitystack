const RELEVANCE_WEIGHTS = {
  High: 3,
  Medium: 2,
  Low: 1,
};

const STATUS_GROUPS = {
  Delivered: "Delivered",
  Partial: "Partial",
  "In Progress": "In Progress",
  Failed: "Blocked/Failed",
  Blocked: "Blocked/Failed",
};

const OUTCOME_MULTIPLIERS = {
  Positive: {
    Delivered: 2.0,
    Partial: 1.0,
    "In Progress": 0.5,
    "Blocked/Failed": -1.0,
  },
  Negative: {
    Delivered: -2.0,
    Partial: -1.0,
    "In Progress": -0.5,
    "Blocked/Failed": 1.0,
  },
  Mixed: {
    Delivered: 0.5,
    Partial: 0.25,
    "In Progress": 0,
    "Blocked/Failed": -0.25,
  },
};

export function getPromiseRelevanceWeight(relevance = "Low") {
  return RELEVANCE_WEIGHTS[relevance] ?? RELEVANCE_WEIGHTS.Low;
}

export function getPromiseStatusGroup(status = "In Progress") {
  return STATUS_GROUPS[status] || "In Progress";
}

export function getPromiseScoringImpactDirection(record = {}) {
  const direction = record.impact_direction_for_curation || record.impact_direction;

  // In v1, blocked or unrealized curation direction is treated as a blocked
  // version of an otherwise positive civic outcome. The status then carries
  // the negative scoring effect through the shared multiplier table.
  if (direction === "Blocked/Unrealized") {
    return "Positive";
  }

  if (direction === "Positive" || direction === "Negative" || direction === "Mixed") {
    return direction;
  }

  if (record.status === "Failed") {
    return "Negative";
  }

  if (record.status === "Blocked") {
    return "Positive";
  }

  if (record.status === "Delivered") {
    return "Positive";
  }

  return "Mixed";
}

export function getPromiseOutcomeMultiplier(record = {}) {
  const direction = getPromiseScoringImpactDirection(record);
  const statusGroup = getPromiseStatusGroup(record.status);
  return OUTCOME_MULTIPLIERS[direction]?.[statusGroup] ?? 0;
}

export function scorePromise(record = {}) {
  const relevance_weight = getPromiseRelevanceWeight(record.relevance);
  const scoring_impact_direction = getPromiseScoringImpactDirection(record);
  const status_group = getPromiseStatusGroup(record.status);
  const outcome_multiplier = getPromiseOutcomeMultiplier(record);
  const raw_score = relevance_weight * outcome_multiplier;
  const max_abs_score = relevance_weight * 2;
  const normalized_score = max_abs_score ? raw_score / max_abs_score : 0;

  return {
    ...record,
    relevance_weight,
    scoring_impact_direction,
    status_group,
    outcome_multiplier,
    raw_score,
    normalized_score,
  };
}

function incrementCounter(bucket, key) {
  if (!key) return;
  bucket[key] = (bucket[key] || 0) + 1;
}

function sumCounter(bucket, key, amount) {
  if (!key) return;
  bucket[key] = (bucket[key] || 0) + amount;
}

function buildScoreExplanation(summary) {
  if (!summary.promise_count) {
    return "No Promise Tracker records are available for this president.";
  }

  if (summary.raw_score > 0) {
    return "The current promise mix trends net positive for Black-community outcomes, with delivered positive records outweighing harmful or blocked records.";
  }

  if (summary.raw_score < 0) {
    return "The current promise mix trends net negative for Black-community outcomes, with harmful deliveries or blocked helpful records outweighing positive delivery.";
  }

  return "The current promise mix is roughly balanced across positive, negative, mixed, and blocked outcomes.";
}

function sortScoredPromises(rows, direction) {
  const sorted = [...rows].sort((a, b) => {
    const scoreDiff = direction === "desc" ? b.raw_score - a.raw_score : a.raw_score - b.raw_score;
    if (scoreDiff !== 0) return scoreDiff;

    const relevanceDiff = b.relevance_weight - a.relevance_weight;
    if (relevanceDiff !== 0) return relevanceDiff;

    const dateA = new Date(a.latest_action_date || a.promise_date || 0).getTime();
    const dateB = new Date(b.latest_action_date || b.promise_date || 0).getTime();
    if (dateA !== dateB) return dateB - dateA;

    return a.title.localeCompare(b.title);
  });

  return sorted.slice(0, 5);
}

export function aggregatePromiseScoresByPresident(rows = []) {
  const byPresident = new Map();

  for (const row of rows) {
    const scored = scorePromise(row);
    const key = scored.president_slug || scored.president;

    if (!byPresident.has(key)) {
      byPresident.set(key, {
        president: scored.president,
        president_slug: scored.president_slug,
        president_party: scored.president_party || null,
        raw_score: 0,
        max_abs_score: 0,
        promise_count: 0,
        counts_by_status: {},
        counts_by_relevance: {},
        counts_by_impact_direction: {},
        score_by_topic: {},
        promises: [],
      });
    }

    const summary = byPresident.get(key);
    summary.raw_score += scored.raw_score;
    summary.max_abs_score += scored.max_abs_score;
    summary.promise_count += 1;
    incrementCounter(summary.counts_by_status, scored.status);
    incrementCounter(summary.counts_by_relevance, scored.relevance);
    incrementCounter(
      summary.counts_by_impact_direction,
      scored.impact_direction_for_curation || scored.scoring_impact_direction
    );
    sumCounter(summary.score_by_topic, scored.topic || "Uncategorized", scored.raw_score);
    summary.promises.push(scored);
  }

  return [...byPresident.values()]
    .map((summary) => {
      const normalized_score = summary.max_abs_score
        ? summary.raw_score / summary.max_abs_score
        : 0;

      return {
        president: summary.president,
        president_slug: summary.president_slug,
        president_party: summary.president_party,
        raw_score: Number(summary.raw_score.toFixed(2)),
        normalized_score: Number(normalized_score.toFixed(4)),
        promise_count: summary.promise_count,
        counts_by_status: summary.counts_by_status,
        counts_by_relevance: summary.counts_by_relevance,
        counts_by_impact_direction: summary.counts_by_impact_direction,
        score_by_topic: Object.entries(summary.score_by_topic)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
          .map(([topic, score]) => ({
            topic,
            raw_score: Number(score.toFixed(2)),
          })),
        top_positive_promises: sortScoredPromises(summary.promises.filter((row) => row.raw_score > 0), "desc"),
        top_negative_promises: sortScoredPromises(summary.promises.filter((row) => row.raw_score < 0), "asc"),
        top_blocked_promises: sortScoredPromises(
          summary.promises.filter(
            (row) =>
              row.status === "Blocked" ||
              row.impact_direction_for_curation === "Blocked/Unrealized"
          ),
          "asc"
        ),
        score_explanation: buildScoreExplanation({
          raw_score: summary.raw_score,
          promise_count: summary.promise_count,
        }),
      };
    })
    .sort((a, b) => {
      if (b.raw_score !== a.raw_score) return b.raw_score - a.raw_score;
      return a.president.localeCompare(b.president);
    });
}

export function getPromiseScoreMethodology() {
  return {
    relevance_weights: RELEVANCE_WEIGHTS,
    outcome_multipliers: OUTCOME_MULTIPLIERS,
    status_grouping: STATUS_GROUPS,
    notes: [
      "Scores are based on relevance, curation-aware impact direction, and promise status.",
      "Blocked/Unrealized curation direction is treated as a blocked positive civic outcome in v1, so blocked helpful promises score negatively through status.",
      "Raw score is the sum of weighted promise contributions.",
      "Normalized score divides the raw score by the maximum absolute score possible from the same promise set.",
    ],
  };
}
