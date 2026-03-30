function computeConfidence({ priority, supportingSignals = [], source }) {
  let score = Math.max(0, Math.min(100, priority || 0));
  score += Math.min(15, supportingSignals.length * 4);

  if (source === "friction") {
    score += 10;
  } else if (source === "trace") {
    score += 8;
  } else if (source === "workflow") {
    score += 5;
  }

  const normalized = Math.max(0.1, Math.min(0.99, score / 100));
  let label = "Low";
  if (normalized >= 0.8) {
    label = "High";
  } else if (normalized >= 0.55) {
    label = "Medium";
  }

  return {
    score: normalized,
    label,
  };
}

function enrichRecommendation(recommendation, feedbackSummaryById) {
  const feedbackSummary =
    feedbackSummaryById.get(recommendation.id) || {
      recommendation_id: recommendation.id,
      helpful_count: 0,
      not_helpful_count: 0,
      dismissed_count: 0,
      latest_feedback: null,
      latest_timestamp: null,
      suppress_until: null,
    };
  const confidence = computeConfidence({
    priority: recommendation.priority,
    supportingSignals: recommendation.supporting_signals,
    source: recommendation.source,
  });

  return {
    ...recommendation,
    confidence,
    evidence_summary:
      recommendation.evidence_summary ||
      (recommendation.supporting_signals || []).slice(0, 2).join("; "),
    supporting_signals: recommendation.supporting_signals || [],
    feedback_summary: feedbackSummary,
  };
}

function dedupeRecommendations(recommendations) {
  const byKey = new Map();

  for (const recommendation of recommendations) {
    const key =
      recommendation.dedupe_key ||
      `${recommendation.href || "no-href"}|${recommendation.suggested_action || recommendation.recommendation}`;
    const existing = byKey.get(key);
    if (!existing || recommendation.priority > existing.priority) {
      byKey.set(key, recommendation);
    }
  }

  return [...byKey.values()];
}

function shouldSuppress(recommendation) {
  const feedback = recommendation.feedback_summary;
  if (!feedback?.suppress_until) {
    return false;
  }
  const suppressUntil = new Date(feedback.suppress_until).getTime();
  const now = Date.now();
  if (Number.isNaN(suppressUntil) || suppressUntil <= now) {
    return false;
  }

  return (recommendation.priority || 0) < 90;
}

export function shapeOperatorRecommendations({
  recommendations = [],
  feedbackSummaryById = new Map(),
  limit = 5,
}) {
  return dedupeRecommendations(
    recommendations.map((recommendation) =>
      enrichRecommendation(recommendation, feedbackSummaryById)
    )
  )
    .filter((recommendation) => !shouldSuppress(recommendation))
    .sort((a, b) => b.priority - a.priority || a.recommendation.localeCompare(b.recommendation))
    .slice(0, limit);
}
