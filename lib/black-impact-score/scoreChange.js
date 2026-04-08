function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundScore(value, digits = 4) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : 0;
}

function normalizeTopicScores(value = {}) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([topic, score]) => [topic, roundScore(score)])
  );
}

function strongestTopicChange(currentTopics = {}, previousTopics = {}) {
  const topics = new Set([...Object.keys(currentTopics), ...Object.keys(previousTopics)]);
  let strongest = null;

  for (const topic of topics) {
    const currentScore = toFiniteNumber(currentTopics[topic]);
    const previousScore = toFiniteNumber(previousTopics[topic]);
    const delta = roundScore(currentScore - previousScore);

    if (!strongest || Math.abs(delta) > Math.abs(strongest.delta_score)) {
      strongest = {
        topic,
        previous_score: previousScore,
        current_score: currentScore,
        delta_score: delta,
      };
    }
  }

  return strongest;
}

function newOutcomeCount(currentOutcomeIds = [], previousOutcomeIds = []) {
  const previous = new Set((previousOutcomeIds || []).map(String));
  return (currentOutcomeIds || []).filter((id) => !previous.has(String(id))).length;
}

function buildChangeSummary({ deltaScore, addedOutcomes, topicChange }) {
  if (!addedOutcomes && Math.abs(deltaScore) < 0.0001) {
    return "Score is unchanged from the latest stored snapshot.";
  }

  const direction = deltaScore > 0 ? "increased" : deltaScore < 0 ? "decreased" : "changed";
  const topicPhrase = topicChange?.topic ? ` in ${topicChange.topic}` : "";
  const outcomePhrase = addedOutcomes
    ? ` with ${addedOutcomes} newly observed outcome(s)`
    : "";

  return `Score ${direction} by ${Math.abs(deltaScore).toFixed(2)}${topicPhrase}${outcomePhrase}.`;
}

export function buildScoreSnapshotFromOutcomePayload({ presidents = [], records = [] } = {}) {
  const topicScores = {};
  const outcomeIds = [];
  let totalScore = 0;
  let normalizedScoreTotal = 0;
  let outcomeCount = 0;

  for (const president of presidents || []) {
    totalScore += toFiniteNumber(president.raw_score_total ?? president.raw_score);
    normalizedScoreTotal += toFiniteNumber(
      president.normalized_score_total ?? president.normalized_score
    );
    outcomeCount += toFiniteNumber(president.outcome_count);
  }

  for (const record of records || []) {
    const topic = record.topic || "Uncategorized";
    topicScores[topic] = (topicScores[topic] || 0) + toFiniteNumber(record.total_score);

    for (const outcome of record.scored_outcomes || []) {
      const id = outcome?.outcome?.id ?? outcome?.id;
      if (id != null) {
        outcomeIds.push(id);
      }
    }
  }

  return {
    total_score: roundScore(totalScore),
    normalized_score_total: roundScore(normalizedScoreTotal),
    outcome_count: outcomeCount,
    topic_scores: normalizeTopicScores(topicScores),
    outcome_ids: [...new Set(outcomeIds.map(String))],
    president_count: (presidents || []).length,
  };
}

export function compareScoreSnapshots(currentSnapshot = {}, previousSnapshot = null) {
  if (!previousSnapshot || typeof previousSnapshot !== "object") {
    return {
      has_prior_snapshot: false,
      change_summary: "No stored prior snapshot is available yet.",
      delta_score: 0,
      new_outcomes_added: 0,
      key_drivers: [],
      previous_snapshot_at: null,
    };
  }

  const currentScore = toFiniteNumber(currentSnapshot.total_score);
  const previousScore = toFiniteNumber(previousSnapshot.total_score);
  const deltaScore = roundScore(currentScore - previousScore);
  const topicChange = strongestTopicChange(
    normalizeTopicScores(currentSnapshot.topic_scores),
    normalizeTopicScores(previousSnapshot.topic_scores)
  );
  const addedOutcomes = newOutcomeCount(
    currentSnapshot.outcome_ids,
    previousSnapshot.outcome_ids
  );
  const keyDrivers = [];

  if (addedOutcomes) {
    keyDrivers.push({
      type: "new_outcomes",
      count: addedOutcomes,
      explanation: `${addedOutcomes} outcome(s) were present in the current score but not the prior snapshot.`,
    });
  }

  if (topicChange && Math.abs(topicChange.delta_score) > 0) {
    keyDrivers.push({
      type: "topic_change",
      ...topicChange,
      explanation: `${topicChange.topic} changed by ${topicChange.delta_score.toFixed(2)} score point(s).`,
    });
  }

  return {
    has_prior_snapshot: true,
    change_summary: buildChangeSummary({
      deltaScore,
      addedOutcomes,
      topicChange,
    }),
    delta_score: deltaScore,
    previous_score: previousScore,
    current_score: currentScore,
    previous_outcome_count: toFiniteNumber(previousSnapshot.outcome_count),
    current_outcome_count: toFiniteNumber(currentSnapshot.outcome_count),
    new_outcomes_added: addedOutcomes,
    strongest_topic_change: topicChange,
    key_drivers: keyDrivers,
    previous_snapshot_at: previousSnapshot.created_at || previousSnapshot.snapshot_created_at || null,
  };
}
