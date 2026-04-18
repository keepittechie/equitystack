import { normalizeScoreTotal } from "./normalization.js";
import { applyCoverageDisplayScore } from "./coverageScaling.js";
import { buildPresidentImpactNarrative } from "./presidentNarrative.js";
import { computePresidentBillBlend, getEmptyPresidentBillImpactInputs } from "./presidentBillInputs.js";

function confidenceLabelFor(score) {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function sumCounter(bucket, key, amount) {
  if (!key) {
    return;
  }

  bucket[key] = Number(((bucket[key] || 0) + amount).toFixed(2));
}

function sortPromisesByScore(rows = [], direction = "desc") {
  return [...rows]
    .sort((a, b) => {
      const scoreDiff = direction === "desc"
        ? b.total_score - a.total_score
        : a.total_score - b.total_score;

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return String(a.title || "").localeCompare(String(b.title || ""));
    })
    .slice(0, 5);
}

function buildPresidentExplanation(summary) {
  if (!summary.promise_count) {
    return "No scored promise records are available for this president.";
  }

  if (summary.raw_score_total > 0) {
    return "Scored outcomes currently trend net positive for this president.";
  }

  if (summary.raw_score_total < 0) {
    return "Scored outcomes currently trend net negative for this president.";
  }

  return "Scored outcomes are currently balanced or neutral for this president.";
}

function getSystemicCategoryLabel(index) {
  if (!Number.isFinite(index)) {
    return null;
  }

  if (index < 0.95) {
    return "Systemically reducing";
  }
  if (index <= 1.05) {
    return "Standard";
  }
  if (index <= 1.15) {
    return "Moderate";
  }
  return "Strong";
}

function summarizePresidentSystemicContext(promises = []) {
  let weightedScoreTotal = 0;
  let scoreTotal = 0;
  let outcomeCount = 0;

  for (const promise of promises) {
    for (const outcome of promise?.scored_outcomes || []) {
      const outcomeScore = Number(outcome?.component_score);
      const systemicMultiplier = Number(
        outcome?.systemic_multiplier ?? outcome?.factors?.systemic_multiplier ?? 1
      );

      if (!Number.isFinite(outcomeScore) || !Number.isFinite(systemicMultiplier)) {
        continue;
      }

      weightedScoreTotal += outcomeScore * systemicMultiplier;
      scoreTotal += outcomeScore;
      outcomeCount += 1;
    }
  }

  if (!outcomeCount || !Number.isFinite(scoreTotal) || Math.abs(scoreTotal) < 1e-9) {
    return {
      systemic_index: null,
      systemic_category_label: null,
      systemic_weighted_score_total: null,
      systemic_score_total: null,
      systemic_outcome_count: 0,
    };
  }

  const systemicIndex = Number((weightedScoreTotal / scoreTotal).toFixed(4));

  return {
    systemic_index: systemicIndex,
    systemic_category_label: getSystemicCategoryLabel(systemicIndex),
    systemic_weighted_score_total: Number(weightedScoreTotal.toFixed(4)),
    systemic_score_total: Number(scoreTotal.toFixed(4)),
    systemic_outcome_count: outcomeCount,
  };
}

function blendPresidentScores(baseScore, billInputs = {}) {
  const directScore = Number(baseScore || 0);
  const {
    bill_blend_weight: billBlendWeight,
    bill_blended_score: billBlendedScore,
    bill_influence_label: billInfluenceLabel,
    bill_blend_components: billBlendComponents,
  } = computePresidentBillBlend(billInputs);
  const normalizedScoreTotal =
    billBlendWeight > 0
      ? Number(
          (
            directScore * (1 - billBlendWeight) +
            Number(billBlendedScore || 0) * billBlendWeight
          ).toFixed(2)
        )
      : directScore;

  return {
    normalized_score_total: normalizedScoreTotal,
    bill_blend_weight: billBlendWeight,
    bill_blend_weight_pct: Number((billBlendWeight * 100).toFixed(2)),
    bill_blended_score: Number(billBlendedScore || 0),
    bill_influence_label: billInfluenceLabel,
    bill_blend_components: billBlendComponents,
    blended_score_modifier: Number((normalizedScoreTotal - directScore).toFixed(2)),
  };
}

export function aggregatePresidentFromOutcomes(records = [], options = {}) {
  const billInputsBySlug =
    options?.billInputsBySlug instanceof Map ? options.billInputsBySlug : new Map();
  const byPresident = new Map();

  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const presidentKey = record.president_slug || record.president;

    if (!presidentKey) {
      continue;
    }

    if (!byPresident.has(presidentKey)) {
      byPresident.set(presidentKey, {
        president: record.president || null,
        president_id: record.president_id ?? null,
        president_slug: record.president_slug || null,
        president_party: record.president_party || null,
        raw_score_total: 0,
        promise_count: 0,
        outcome_count: 0,
        counts_by_direction: {},
        counts_by_confidence: {},
        counts_by_completeness: {},
        score_by_topic: {},
        confidence_score_total: 0,
        confidence_score_count: 0,
        promises: [],
      });
    }

    const summary = byPresident.get(presidentKey);
    const totalScore = Number(record.total_score || 0);
    const outcomeCount = Number(record.outcome_count || 0);

    summary.raw_score_total += totalScore;
    summary.promise_count += 1;
    summary.outcome_count += outcomeCount;
    summary.promises.push(record);

    const confidenceScore = Number(record.confidence_score);
    if (Number.isFinite(confidenceScore)) {
      summary.confidence_score_total += confidenceScore;
      summary.confidence_score_count += 1;
    }

    for (const [label, count] of Object.entries(record.breakdown_by_direction || {})) {
      summary.counts_by_direction[label] = (summary.counts_by_direction[label] || 0) + Number(count || 0);
    }

    for (const [label, count] of Object.entries(record.breakdown_by_confidence || {})) {
      summary.counts_by_confidence[label] = (summary.counts_by_confidence[label] || 0) + Number(count || 0);
    }

    for (const [label, count] of Object.entries(record.breakdown_by_completeness || {})) {
      summary.counts_by_completeness[label] = (summary.counts_by_completeness[label] || 0) + Number(count || 0);
    }

    sumCounter(summary.score_by_topic, record.topic || "Uncategorized", totalScore);
  }

  return [...byPresident.values()]
    .map((summary) => {
      const rawScoreTotal = Number(summary.raw_score_total.toFixed(2));
      const normalizedScoreTotal = normalizeScoreTotal(rawScoreTotal, summary.outcome_count);
      const systemicContext = summarizePresidentSystemicContext(summary.promises);
      const billInputs =
        billInputsBySlug.get(summary.president_slug || summary.president) ||
        getEmptyPresidentBillImpactInputs({
          president_slug: summary.president_slug,
          president: summary.president,
        });
      const blendedScore = blendPresidentScores(normalizedScoreTotal, billInputs);
      const displayScore = applyCoverageDisplayScore(
        blendedScore.normalized_score_total,
        summary.outcome_count
      );
      const directDisplayScore = applyCoverageDisplayScore(
        normalizedScoreTotal,
        summary.outcome_count
      );
      const confidenceScore = summary.confidence_score_count
        ? Number((summary.confidence_score_total / summary.confidence_score_count).toFixed(4))
        : 0;
      const hasInsufficient = Number(summary.counts_by_completeness.insufficient || 0) > 0;
      const hasPartial = Number(summary.counts_by_completeness.partial || 0) > 0;

      const presidentSummary = {
        president: summary.president,
        president_id: summary.president_id,
        president_slug: summary.president_slug,
        president_party: summary.president_party,
        raw_score_total: rawScoreTotal,
        normalized_score_total: blendedScore.normalized_score_total,
        direct_raw_score: rawScoreTotal,
        direct_normalized_score: normalizedScoreTotal,
        direct_display_score: directDisplayScore.display_score,
        direct_outcome_count: summary.outcome_count,
        direct_score_confidence: directDisplayScore.score_confidence,
        systemic_raw_score: systemicContext.systemic_weighted_score_total,
        systemic_normalized_score: systemicContext.systemic_index,
        systemic_display_score: systemicContext.systemic_index,
        systemic_index: systemicContext.systemic_index,
        systemic_category_label: systemicContext.systemic_category_label,
        systemic_outcome_count: systemicContext.systemic_outcome_count,
        systemic_score_confidence: systemicContext.systemic_index != null
          ? directDisplayScore.score_confidence
          : null,
        combined_context_score: rawScoreTotal,
        combined_context_normalized_score: blendedScore.normalized_score_total,
        primary_score_family:
          blendedScore.bill_blend_weight > 0 ? "direct_with_bill_inputs" : "direct",
        display_score: displayScore.display_score,
        display_score_total: displayScore.display_score,
        score_confidence: displayScore.score_confidence,
        score_confidence_factor: displayScore.score_confidence_factor,
        score_confidence_basis: displayScore.score_confidence_basis,
        low_coverage_warning: displayScore.low_coverage_warning,
        confidence_score: confidenceScore,
        confidence_label: confidenceLabelFor(confidenceScore),
        completeness_label: hasInsufficient ? "insufficient" : hasPartial ? "partial" : "complete",
        promise_count: summary.promise_count,
        outcome_count: summary.outcome_count,
        counts: {
          promises: summary.promise_count,
          outcomes: summary.outcome_count,
        },
        bill_impact_inputs: {
          ...billInputs,
          ...blendedScore,
        },
        linked_bill_count: billInputs.linked_bill_count,
        linked_bill_score_avg: billInputs.linked_bill_score_avg,
        linked_bill_score_weighted: billInputs.linked_bill_score_weighted,
        linked_positive_bill_count: billInputs.linked_positive_bill_count,
        linked_mixed_bill_count: billInputs.linked_mixed_bill_count,
        linked_negative_bill_count: billInputs.linked_negative_bill_count,
        linked_bill_confidence_summary: billInputs.linked_bill_confidence_summary,
        linked_bill_relationship_types: billInputs.linked_bill_relationship_types,
        linked_bill_domains: billInputs.linked_bill_domains,
        linked_promises_with_bill_support: billInputs.linked_promises_with_bill_support,
        bill_input_method: billInputs.bill_input_method,
        top_linked_bills: billInputs.top_linked_bills || [],
        bill_blend_weight: blendedScore.bill_blend_weight,
        bill_blend_weight_pct: blendedScore.bill_blend_weight_pct,
        bill_blended_score: blendedScore.bill_blended_score,
        bill_influence_label: blendedScore.bill_influence_label,
        blended_score_modifier: blendedScore.blended_score_modifier,
        breakdowns: {
          by_direction: summary.counts_by_direction,
          by_confidence: summary.counts_by_confidence,
          by_completeness: summary.counts_by_completeness,
          by_topic: Object.entries(summary.score_by_topic)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
            .map(([topic, score]) => ({
              topic,
              raw_score_total: Number(score.toFixed(2)),
            })),
        },
        top_positive_promises: sortPromisesByScore(
          summary.promises.filter((promise) => Number(promise.total_score || 0) > 0),
          "desc"
        ),
        top_negative_promises: sortPromisesByScore(
          summary.promises.filter((promise) => Number(promise.total_score || 0) < 0),
          "asc"
        ),
        explanation_summary: [
          buildPresidentExplanation({
            raw_score_total: rawScoreTotal,
            promise_count: summary.promise_count,
          }),
          blendedScore.bill_blend_weight > 0
            ? `${blendedScore.bill_influence_label}; bill-linked inputs adjust the final normalized score by ${blendedScore.blended_score_modifier >= 0 ? "+" : ""}${blendedScore.blended_score_modifier}.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      };
      const impactNarrative = buildPresidentImpactNarrative(presidentSummary);

      return {
        ...presidentSummary,
        impact_narrative: impactNarrative,
        narrative_summary: impactNarrative.summary_paragraph,
        key_strengths: impactNarrative.key_strengths,
        key_weaknesses: impactNarrative.key_weaknesses,
        confidence_statement: impactNarrative.confidence_statement,
      };
    })
    .sort((a, b) => {
      if (b.raw_score_total !== a.raw_score_total) {
        return b.raw_score_total - a.raw_score_total;
      }

      return String(a.president || "").localeCompare(String(b.president || ""));
    });
}
