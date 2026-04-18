import { query } from "@/lib/db";
import {
  computeOutcomeScore,
  isOutcomeScoringReady,
} from "@/lib/black-impact-score/outcomeScoring.js";
import {
  filterOutcomesByConfidence,
  normalizeConfidenceFilter,
  summarizeConfidenceFilteredImpact,
  summarizeOutcomeConfidence,
} from "@/lib/black-impact-score/confidence.js";
import { summarizeOutcomeCompleteness } from "@/lib/black-impact-score/completeness.js";
import { computePromiseFromOutcomes } from "@/lib/black-impact-score/promiseRollup.js";
import { aggregatePresidentFromOutcomes } from "@/lib/black-impact-score/presidentAggregation.js";
import { summarizeEvidenceStrengthNormalization } from "@/lib/black-impact-score/evidenceStrength.js";
import { buildOutcomeCoverageMetadata } from "@/lib/black-impact-score/outcomeCoverage.js";
import { summarizeScoreExplanations } from "@/lib/black-impact-score/scoreExplanations.js";
import {
  filterOutcomesByTrust,
  normalizeTrustFilter,
  summarizeTrustForOutcomes,
} from "@/lib/black-impact-score/trustLayer.js";
import { summarizeImpactTrend } from "@/lib/black-impact-score/impactTrend.js";
import {
  buildScoreSnapshotFromOutcomePayload,
  compareScoreSnapshots,
} from "@/lib/black-impact-score/scoreChange.js";
import {
  buildPresidentBillValidationSample,
  fetchPresidentBillImpactInputs,
} from "@/lib/black-impact-score/presidentBillInputs.js";
import { normalizePromiseTopicLabel } from "@/lib/promise-topics";
import { summarizeSourceQuality, summarizeSourceQualityDistribution } from "@/lib/sourceQuality.js";

function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function toSafeCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function parseOutcomeSourceSnapshot(value) {
  const text = normalizeNullableString(value);
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map((row) => {
      const [sourceId, sourceUrl, sourceType, publisher] = row.split("\t");
      const numericSourceId = Number(sourceId);
      return {
        source_id: Number.isFinite(numericSourceId) ? numericSourceId : null,
        source_url: normalizeNullableString(sourceUrl),
        source_type: normalizeNullableString(sourceType),
        publisher: normalizeNullableString(publisher),
      };
    })
    .filter((row) => row.source_id != null || row.source_url || row.source_type || row.publisher);
}

function createPromiseShape(row) {
  return {
    id: row.promise_id,
    slug: row.promise_slug,
    title: row.promise_title,
    promise_date: row.promise_date,
    topic: normalizePromiseTopicLabel(row.promise_topic),
    status: row.promise_status,
    president: row.president,
    president_id: row.president_id,
    president_slug: row.president_slug,
    president_party: row.president_party,
  };
}

function createOutcomeShape(row) {
  if (!row.outcome_id) {
    return null;
  }

  const sourceQualitySummary = summarizeSourceQuality(
    parseOutcomeSourceSnapshot(row.outcome_source_snapshot)
  );

  return {
    id: row.outcome_id,
    promise_id: row.promise_id,
    outcome_summary: normalizeNullableString(row.outcome_summary),
    outcome_type: normalizeNullableString(row.outcome_type),
    impact_direction: normalizeNullableString(row.impact_direction),
    evidence_strength: normalizeNullableString(row.evidence_strength),
    measurable_impact: normalizeNullableString(row.measurable_impact),
    black_community_impact_note: normalizeNullableString(
      row.black_community_impact_note
    ),
    status_override: normalizeNullableString(row.status_override),
    source_count: toSafeCount(row.outcome_source_count),
    source_quality_label: sourceQualitySummary.source_quality_label,
    source_quality_score: sourceQualitySummary.source_quality_score,
    source_quality_summary: sourceQualitySummary,
    impact_start_date: row.impact_start_date ?? null,
    impact_end_date: row.impact_end_date ?? null,
    impact_duration_estimate: normalizeNullableString(row.impact_duration_estimate),
  };
}

function isScoredOutcome(entry) {
  return Boolean(
    entry &&
      typeof entry === "object" &&
      entry.factors?.scoring_ready === true &&
      typeof entry.component_score === "number"
  );
}

function summarizePolicyConfidence({ promise = {}, scoredOutcomes = [] } = {}) {
  const outcomes = Array.isArray(scoredOutcomes) ? scoredOutcomes : [];
  const distribution = { high: 0, medium: 0, low: 0 };
  let totalConfidenceScore = 0;
  let confidenceCount = 0;
  let scoringReadyCount = 0;

  for (const outcome of outcomes) {
    const confidenceScore = Number(outcome?.confidence_score);
    if (!Number.isFinite(confidenceScore)) {
      continue;
    }

    const confidenceLabel = outcome.confidence_label || "low";
    distribution[confidenceLabel] = (distribution[confidenceLabel] || 0) + 1;
    totalConfidenceScore += confidenceScore;
    confidenceCount += 1;

    if (outcome?.factors?.scoring_ready === true) {
      scoringReadyCount += 1;
    }
  }

  return {
    promise_id: promise.id ?? null,
    promise_slug: promise.slug ?? null,
    promise_title: promise.title ?? null,
    president: promise.president ?? null,
    outcome_count: outcomes.length,
    scoring_ready_outcome_count: scoringReadyCount,
    average_confidence_score: confidenceCount
      ? Number((totalConfidenceScore / confidenceCount).toFixed(4))
      : 0,
    confidence_distribution: distribution,
    low_confidence_percentage: confidenceCount
      ? Number(((distribution.low || 0) / confidenceCount).toFixed(4))
      : 0,
  };
}

function shouldIncludeScoreExplanations(options = {}) {
  const value =
    options.include_score_explanations ??
    options.includeScoreExplanations ??
    options.debug_explanations ??
    options.debug;

  if (value === true) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  return ["true", "1", "yes", "on", "explanations", "score_explanations"].includes(
    value.trim().toLowerCase()
  );
}

async function fetchLatestScoreSnapshot(snapshotKey = "promise-score-api-outcome") {
  try {
    const rows = await query(
      `
      SELECT
        snapshot_payload,
        created_at
      FROM black_impact_score_snapshots
      WHERE snapshot_key = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `,
      [snapshotKey]
    );
    const row = rows?.[0];
    if (!row?.snapshot_payload) {
      return null;
    }

    const payload =
      typeof row.snapshot_payload === "string"
        ? JSON.parse(row.snapshot_payload)
        : row.snapshot_payload;

    return {
      ...payload,
      created_at: row.created_at,
    };
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146) {
      return null;
    }
    throw error;
  }
}

export async function fetchPromisesWithOutcomesForScoring() {
  const rows = await query(`
    SELECT
      p.id AS promise_id,
      p.slug AS promise_slug,
      p.title AS promise_title,
      p.promise_date,
      p.topic AS promise_topic,
      p.status AS promise_status,
      pr.full_name AS president,
      pr.id AS president_id,
      pr.slug AS president_slug,
      pa.name AS president_party,
      po.id AS outcome_id,
      po.outcome_summary,
      po.outcome_type,
      po.impact_direction,
      po.evidence_strength,
      po.measurable_impact,
      po.black_community_impact_note,
      po.status_override,
      uo.impact_start_date,
      uo.impact_end_date,
      uo.impact_duration_estimate,
      (
        SELECT COUNT(DISTINCT pos.source_id)
        FROM policy_outcome_sources pos
        WHERE pos.policy_outcome_id = uo.id
      ) AS outcome_source_count,
      (
        SELECT GROUP_CONCAT(
          DISTINCT CONCAT_WS(
            '\t',
            s.id,
            COALESCE(s.source_url, ''),
            COALESCE(s.source_type, ''),
            COALESCE(s.publisher, '')
          )
          SEPARATOR '\n'
        )
        FROM policy_outcome_sources pos
        JOIN sources s ON s.id = pos.source_id
        WHERE pos.policy_outcome_id = uo.id
      ) AS outcome_source_snapshot
    FROM promises p
    JOIN presidents pr ON pr.id = p.president_id
    LEFT JOIN parties pa ON pa.id = pr.party_id
    LEFT JOIN promise_outcomes po ON po.promise_id = p.id
    LEFT JOIN policy_outcomes uo
      ON uo.policy_type = 'current_admin'
     AND uo.policy_id = p.id
     AND uo.outcome_summary_hash = SHA2(TRIM(po.outcome_summary), 256)
    ORDER BY pr.term_start ASC, p.promise_date ASC, p.id ASC, po.id ASC
  `);

  const uniquePromiseIds = new Set();
  let outcomeCount = 0;

  for (const row of rows) {
    if (row.promise_id) {
      uniquePromiseIds.add(row.promise_id);
    }

    if (row.outcome_id) {
      outcomeCount += 1;
    }
  }

  console.debug(
    `[black-impact-score] loaded ${uniquePromiseIds.size} promises and ${outcomeCount} outcomes for scoring`
  );

  return rows;
}

export function prepareScoreContexts(records = []) {
  const byPromise = new Map();

  for (const row of records) {
    if (!row || typeof row !== "object" || !row.promise_id) {
      continue;
    }

    if (!byPromise.has(row.promise_id)) {
      byPromise.set(row.promise_id, {
        promise: createPromiseShape(row),
        outcomes: [],
        _seenOutcomeIds: new Set(),
      });
    }

    const context = byPromise.get(row.promise_id);
    const outcome = createOutcomeShape(row);

    if (!outcome) {
      continue;
    }

    if (context._seenOutcomeIds.has(outcome.id)) {
      continue;
    }

    context._seenOutcomeIds.add(outcome.id);
    context.outcomes.push(outcome);
  }

  return [...byPromise.values()].map((context) => ({
    promise: { ...context.promise },
    outcomes: [...context.outcomes],
  }));
}

export async function computeOutcomeBasedScores(options = {}) {
  const confidenceFilter = normalizeConfidenceFilter(
    options.confidence_filter ?? options.confidenceFilter ?? options
  );
  const trustFilter = normalizeTrustFilter(options.trust_filter ?? options.trustFilter ?? options);
  const includeScoreExplanations = shouldIncludeScoreExplanations(options);
  const records = await fetchPromisesWithOutcomesForScoring();
  const contexts = prepareScoreContexts(records);

  let totalLoadedOutcomes = 0;
  let totalScorableOutcomes = 0;
  let totalConfidenceFilteredScorableOutcomes = 0;
  let totalTrustFilteredScorableOutcomes = 0;
  const evidenceStrengthValues = [];
  const loadedOutcomes = [];
  const evaluatedOutcomes = [];
  const scorableOutcomesAllData = [];
  const sourceQualitySummaries = [];
  const confidenceDistributionByPolicy = [];

  const scoredPromises = contexts
    .map((context) => {
      totalLoadedOutcomes += context.outcomes.length;
      loadedOutcomes.push(...context.outcomes);
      sourceQualitySummaries.push(
        ...context.outcomes.map((outcome) => outcome.source_quality_summary)
      );
      evidenceStrengthValues.push(
        ...context.outcomes.map((outcome) => outcome.evidence_strength)
      );
      const scoringReadyOutcomeCount = context.outcomes.filter((outcome) =>
        isOutcomeScoringReady({
          outcome,
          source_count: outcome.source_count,
        })
      ).length;

      const scoredOutcomes = context.outcomes.map((outcome) => ({
        ...computeOutcomeScore({
          outcome,
          source_count: outcome.source_count,
          scoring_ready_outcome_count: scoringReadyOutcomeCount,
        }),
        topic: context.promise.topic,
        promise_title: context.promise.title,
        president: context.promise.president,
        president_slug: context.promise.president_slug,
      }));
      evaluatedOutcomes.push(...scoredOutcomes);
      confidenceDistributionByPolicy.push(
        summarizePolicyConfidence({
          promise: context.promise,
          scoredOutcomes,
        })
      );

      const scorableOutcomes = scoredOutcomes.filter(isScoredOutcome);
      const confidenceFilteredScorableOutcomes = filterOutcomesByConfidence(
        scorableOutcomes,
        confidenceFilter
      );
      const trustFilteredScorableOutcomes = filterOutcomesByTrust(
        confidenceFilteredScorableOutcomes,
        trustFilter
      );
      totalScorableOutcomes += scorableOutcomes.length;
      totalConfidenceFilteredScorableOutcomes += confidenceFilteredScorableOutcomes.length;
      totalTrustFilteredScorableOutcomes += trustFilteredScorableOutcomes.length;
      scorableOutcomesAllData.push(...scorableOutcomes);

      // Keep the raw fetch broad, but only return promises that actually
      // participate in the parallel outcome-based model.
      if (!trustFilteredScorableOutcomes.length) {
        return null;
      }

      return computePromiseFromOutcomes({
        promise: context.promise,
        scored_outcomes: trustFilteredScorableOutcomes,
      });
    })
    .filter(Boolean);

  console.debug(
    `[black-impact-score] prepared ${scoredPromises.length} scored promises and processed ${totalTrustFilteredScorableOutcomes}/${totalScorableOutcomes} trust-filtered scorable outcomes`
  );
  const coverageMetadata = buildOutcomeCoverageMetadata(loadedOutcomes);
  const sourceQualityDistribution = summarizeSourceQualityDistribution(sourceQualitySummaries);
  const confidenceMetadata = summarizeOutcomeConfidence(evaluatedOutcomes);
  const completenessMetadata = summarizeOutcomeCompleteness(evaluatedOutcomes);
  const trustMetadataBase = summarizeTrustForOutcomes(evaluatedOutcomes, trustFilter);
  const trustMetadata = {
    ...trustMetadataBase,
    scored_outcomes_after_all_filters: totalTrustFilteredScorableOutcomes,
    interpretation: `This score is based on ${totalTrustFilteredScorableOutcomes} scored outcome(s), with ${Math.round(
      trustMetadataBase.high_confidence_outcome_percentage * 100
    )}% high-confidence data and ${Math.round(
      trustMetadataBase.incomplete_outcome_percentage * 100
    )}% incomplete records across ${trustMetadataBase.outcomes_evaluated_for_trust} evaluated outcome(s).`,
  };
  const confidenceFilteredImpact = summarizeConfidenceFilteredImpact(
    scorableOutcomesAllData,
    confidenceFilter
  );
  const scoreExplanations = includeScoreExplanations
    ? summarizeScoreExplanations(scoredPromises)
    : null;
  const impactTrend = summarizeImpactTrend(scorableOutcomesAllData);
  const [previousScoreSnapshot, billImpactContext] = await Promise.all([
    fetchLatestScoreSnapshot(),
    fetchPresidentBillImpactInputs(),
  ]);

  const presidents = aggregatePresidentFromOutcomes(scoredPromises, {
    billInputsBySlug: billImpactContext.bySlug,
  });
  const currentScoreSnapshot = buildScoreSnapshotFromOutcomePayload({
    presidents,
    records: scoredPromises,
  });
  const scoreChange = compareScoreSnapshots(currentScoreSnapshot, previousScoreSnapshot);

  return {
    // This service remains parallel and non-breaking until a later API phase.
    records: scoredPromises,
    presidents,
    metadata: {
      total_promises: scoredPromises.length,
      total_outcomes: totalTrustFilteredScorableOutcomes,
      total_outcomes_before_confidence_filter: totalScorableOutcomes,
      total_outcomes_excluded_by_confidence_filter: Math.max(
        totalScorableOutcomes - totalConfidenceFilteredScorableOutcomes,
        0
      ),
      total_outcomes_before_trust_filter: totalConfidenceFilteredScorableOutcomes,
      total_outcomes_excluded_by_trust_filter: Math.max(
        totalConfidenceFilteredScorableOutcomes - totalTrustFilteredScorableOutcomes,
        0
      ),
      total_loaded_promises: contexts.length,
      total_loaded_outcomes: totalLoadedOutcomes,
      total_excluded_outcomes: Math.max(totalLoadedOutcomes - totalScorableOutcomes, 0),
      ...coverageMetadata,
      evidence_strength_normalization: summarizeEvidenceStrengthNormalization(
        evidenceStrengthValues
      ),
      source_quality_distribution: sourceQualityDistribution,
      outcome_confidence: {
        ...confidenceMetadata,
        confidence_filter: confidenceFilter,
        filtered_impact_summary: confidenceFilteredImpact,
        confidence_distribution_by_policy: confidenceDistributionByPolicy,
      },
      outcome_completeness: completenessMetadata,
      trust: trustMetadata,
      impact_trend: impactTrend,
      score_snapshot: currentScoreSnapshot,
      score_change: scoreChange,
      summary_interpretation: trustMetadata.interpretation,
      score_families: {
        primary: "final_black_impact_score",
        final_black_impact_score:
          "Primary headline score. Anchored in outcome-based scoring, then blended modestly with validated bill-informed inputs when current bill-to-promise-to-president lineage supports them.",
        direct_black_impact_score:
          "Outcome-based anchor score. Includes direct current-admin promise outcomes in this API path before any bill-informed blending.",
        systemic_impact_score:
          "Separate score family for judicial_impact and other explicitly indirect/systemic outcomes when available in unified reports.",
        combined_context_score:
          "Optional contextual blended score in unified reports. It is not the primary score.",
      },
      ...(scoreExplanations ? { score_explanations: scoreExplanations } : {}),
      bill_inputs: billImpactContext.summary,
      ...(includeScoreExplanations
        ? {
            bill_input_validation_sample: buildPresidentBillValidationSample(presidents),
          }
        : {}),
      scoring_model: "outcome-based-v1",
    },
  };
}
