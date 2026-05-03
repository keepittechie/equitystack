import { NextResponse } from "next/server";
import {
  fetchPromiseScoreRecords,
  fetchPromiseScoreSummaries,
} from "@/lib/services/promiseService";
import { computeOutcomeBasedScores } from "@/lib/services/blackImpactScoreService";
import { getBlackImpactScoreMethodology } from "@/lib/black-impact-score/methodology.js";
import { buildPresidentComparison } from "@/lib/black-impact-score/presidentComparison.js";

function isPromiseTrackerSchemaMissing(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146;
}

function getRequestedModel(request) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get("model");

  if (model === "legacy" || model === "outcome" || model === "compare") {
    return model;
  }

  return "outcome";
}

function getConfidenceOptions(request) {
  const { searchParams } = new URL(request.url);

  return {
    confidence_filter: {
      confidence: searchParams.get("confidence") ?? "all",
      min_confidence: searchParams.get("min_confidence"),
      include_low_confidence: searchParams.get("include_low_confidence"),
    },
    trust_filter: {
      exclude_incomplete: searchParams.get("exclude_incomplete"),
    },
    debug: searchParams.get("debug"),
    include_score_explanations: searchParams.get("score_explanations"),
  };
}

function getComparisonIdentifiers(request) {
  const { searchParams } = new URL(request.url);
  const identifiers = [
    searchParams.get("presidents"),
    searchParams.get("president_ids"),
    searchParams.get("president_slugs"),
    searchParams.get("compare"),
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(identifiers)];
}

function buildEmptyLegacyPayload() {
  return {
    methodology: null,
    items: [],
    records: [],
  };
}

function buildLegacyPayload(data, records = []) {
  return {
    methodology: data?.methodology ?? null,
    items: Array.isArray(data?.items) ? data.items : [],
    records: Array.isArray(records) ? records : [],
  };
}

function buildOutcomePayload(data) {
  return {
    methodology: getBlackImpactScoreMethodology(),
    items: Array.isArray(data?.presidents) ? data.presidents : [],
    records: Array.isArray(data?.records) ? data.records : [],
    ...(data?.comparison ? { comparison: data.comparison } : {}),
    metadata: data?.metadata ?? {
      total_promises: 0,
      total_outcomes: 0,
      total_outcomes_before_confidence_filter: 0,
      total_outcomes_excluded_by_confidence_filter: 0,
      total_outcomes_before_trust_filter: 0,
      total_outcomes_excluded_by_trust_filter: 0,
      total_outcomes_available: 0,
      outcomes_included_in_score: 0,
      outcomes_excluded_from_score: 0,
      excluded_due_to_missing_sources: 0,
      excluded_due_to_missing_direction: 0,
      excluded_due_to_missing_summary: 0,
      excluded_due_to_low_confidence_or_status: 0,
      source_quality_distribution: {
        tier_counts: {
          high_authority: 0,
          institutional: 0,
          secondary: 0,
          low_unverified: 0,
        },
        outcomes_with_any_sources: 0,
        outcomes_with_high_authority_sources: 0,
        pct_outcomes_with_high_authority_sources: 0,
      },
      outcome_confidence: {
        average_confidence_score: 0,
        confidence_distribution: { high: 0, medium: 0, low: 0 },
        confidence_by_scoring_readiness: {
          scoring_ready: { count: 0, average_confidence_score: 0 },
          excluded_from_score: { count: 0, average_confidence_score: 0 },
        },
        confidence_vs_impact_score: {},
        confidence_filter: {
          mode: "all",
          threshold: 0,
          include_low_confidence: true,
          requested_include_low_confidence: null,
          description: "All confidence levels included.",
        },
        filtered_impact_summary: {
          scored_outcomes_all_data: 0,
          scored_outcomes_after_confidence_filter: 0,
          scored_outcomes_excluded_by_confidence_filter: 0,
          average_impact_score_all_data: 0,
          average_impact_score_filtered: 0,
          average_impact_score_high_confidence_only: 0,
          low_confidence_outcome_count: 0,
          low_confidence_outcome_percentage: 0,
        },
        confidence_distribution_by_policy: [],
      },
      outcome_completeness: {
        average_data_completeness_score: 0,
        completeness_distribution: { complete: 0, partial: 0, insufficient: 0 },
        incomplete_outcome_count: 0,
        incomplete_outcome_percentage: 0,
        insufficient_outcome_count: 0,
        insufficient_outcome_percentage: 0,
        missing_field_counts: {},
        completeness_vs_confidence: {},
        policies_with_highest_missing_data: [],
        recommendations: [],
      },
      trust: {
        trust_filter: {
          exclude_incomplete: false,
          description: "All completeness levels are included.",
        },
        outcomes_evaluated_for_trust: 0,
        scored_outcomes_all_data: 0,
        scored_outcomes_after_trust_filter: 0,
        scored_outcomes_after_all_filters: 0,
        scored_outcomes_excluded_by_trust_filter: 0,
        confidence_distribution: { high: 0, medium: 0, low: 0 },
        completeness_distribution: { complete: 0, partial: 0, insufficient: 0 },
        high_confidence_outcome_percentage: 0,
        low_confidence_outcome_percentage: 0,
        incomplete_outcome_percentage: 0,
        average_confidence_score: 0,
        average_data_completeness_score: 0,
        confidence_vs_impact_correlation: null,
        completeness_vs_confidence_trends: {
          correlation: null,
          by_completeness_label: [],
        },
        warnings: {
          low_confidence_high_impact_outcome_count: 0,
          incomplete_but_scored_outcome_count: 0,
          low_confidence_high_impact_outcomes: [],
          incomplete_but_scored_outcomes: [],
        },
        interpretation: "This score is based on 0 scored outcome(s).",
      },
      impact_trend: {
        score_by_year: [],
        cumulative_score: 0,
        trend_direction: "stable",
        strongest_shift: null,
        dated_outcome_count: 0,
        undated_outcome_count: 0,
        interpretation: "No dated scored outcomes are available for time-based impact analysis.",
      },
      score_snapshot: null,
      score_change: {
        has_prior_snapshot: false,
        change_summary: "No stored prior snapshot is available yet.",
        delta_score: 0,
        new_outcomes_added: 0,
        key_drivers: [],
        previous_snapshot_at: null,
      },
      summary_interpretation: "This score is based on 0 scored outcome(s).",
      score_families: {
        primary: "direct_black_impact_score",
        direct_black_impact_score: "Primary headline score. Includes direct current-admin promise outcomes in this API path.",
        systemic_impact_score: "Separate score family for judicial_impact outcomes when available in unified reports.",
        combined_context_score: "Optional contextual blended score in unified reports. It is not the primary score.",
      },
      scoring_model: "outcome-based-v1",
    },
  };
}

function buildOutcomeErrorPayload() {
  return {
    error: true,
    methodology: getBlackImpactScoreMethodology(),
    items: [],
    records: [],
    metadata: {
      total_promises: 0,
      total_outcomes: 0,
      total_outcomes_before_confidence_filter: 0,
      total_outcomes_excluded_by_confidence_filter: 0,
      total_outcomes_before_trust_filter: 0,
      total_outcomes_excluded_by_trust_filter: 0,
      total_outcomes_available: 0,
      outcomes_included_in_score: 0,
      outcomes_excluded_from_score: 0,
      excluded_due_to_missing_sources: 0,
      excluded_due_to_missing_direction: 0,
      excluded_due_to_missing_summary: 0,
      excluded_due_to_low_confidence_or_status: 0,
      source_quality_distribution: {
        tier_counts: {
          high_authority: 0,
          institutional: 0,
          secondary: 0,
          low_unverified: 0,
        },
        outcomes_with_any_sources: 0,
        outcomes_with_high_authority_sources: 0,
        pct_outcomes_with_high_authority_sources: 0,
      },
      outcome_confidence: {
        average_confidence_score: 0,
        confidence_distribution: { high: 0, medium: 0, low: 0 },
        confidence_by_scoring_readiness: {
          scoring_ready: { count: 0, average_confidence_score: 0 },
          excluded_from_score: { count: 0, average_confidence_score: 0 },
        },
        confidence_vs_impact_score: {},
        confidence_filter: {
          mode: "all",
          threshold: 0,
          include_low_confidence: true,
          requested_include_low_confidence: null,
          description: "All confidence levels included.",
        },
        filtered_impact_summary: {
          scored_outcomes_all_data: 0,
          scored_outcomes_after_confidence_filter: 0,
          scored_outcomes_excluded_by_confidence_filter: 0,
          average_impact_score_all_data: 0,
          average_impact_score_filtered: 0,
          average_impact_score_high_confidence_only: 0,
          low_confidence_outcome_count: 0,
          low_confidence_outcome_percentage: 0,
        },
        confidence_distribution_by_policy: [],
      },
      outcome_completeness: {
        average_data_completeness_score: 0,
        completeness_distribution: { complete: 0, partial: 0, insufficient: 0 },
        incomplete_outcome_count: 0,
        incomplete_outcome_percentage: 0,
        insufficient_outcome_count: 0,
        insufficient_outcome_percentage: 0,
        missing_field_counts: {},
        completeness_vs_confidence: {},
        policies_with_highest_missing_data: [],
        recommendations: [],
      },
      trust: {
        trust_filter: {
          exclude_incomplete: false,
          description: "All completeness levels are included.",
        },
        outcomes_evaluated_for_trust: 0,
        scored_outcomes_all_data: 0,
        scored_outcomes_after_trust_filter: 0,
        scored_outcomes_after_all_filters: 0,
        scored_outcomes_excluded_by_trust_filter: 0,
        confidence_distribution: { high: 0, medium: 0, low: 0 },
        completeness_distribution: { complete: 0, partial: 0, insufficient: 0 },
        high_confidence_outcome_percentage: 0,
        low_confidence_outcome_percentage: 0,
        incomplete_outcome_percentage: 0,
        average_confidence_score: 0,
        average_data_completeness_score: 0,
        confidence_vs_impact_correlation: null,
        completeness_vs_confidence_trends: {
          correlation: null,
          by_completeness_label: [],
        },
        warnings: {
          low_confidence_high_impact_outcome_count: 0,
          incomplete_but_scored_outcome_count: 0,
          low_confidence_high_impact_outcomes: [],
          incomplete_but_scored_outcomes: [],
        },
        interpretation: "This score is based on 0 scored outcome(s).",
      },
      impact_trend: {
        score_by_year: [],
        cumulative_score: 0,
        trend_direction: "stable",
        strongest_shift: null,
        dated_outcome_count: 0,
        undated_outcome_count: 0,
        interpretation: "No dated scored outcomes are available for time-based impact analysis.",
      },
      score_snapshot: null,
      score_change: {
        has_prior_snapshot: false,
        change_summary: "No stored prior snapshot is available yet.",
        delta_score: 0,
        new_outcomes_added: 0,
        key_drivers: [],
        previous_snapshot_at: null,
      },
      summary_interpretation: "This score is based on 0 scored outcome(s).",
      score_families: {
        primary: "direct_black_impact_score",
        direct_black_impact_score: "Primary headline score. Includes direct current-admin promise outcomes in this API path.",
        systemic_impact_score: "Separate score family for judicial_impact outcomes when available in unified reports.",
        combined_context_score: "Optional contextual blended score in unified reports. It is not the primary score.",
      },
      scoring_model: "outcome-based-v1",
    },
  };
}

function buildResponseBody({ model, legacyPayload, outcomePayload }) {
  if (model === "legacy") {
    return {
      model,
      ...legacyPayload,
    };
  }

  if (model === "outcome") {
    return {
      model,
      ...outcomePayload,
    };
  }

  return {
    model,
    ...legacyPayload,
    legacy: legacyPayload,
    outcome: outcomePayload,
  };
}

function buildLegacyFallbackResponse(legacyPayload) {
  return {
    model: "legacy",
    notice: "Outcome-based scoring is temporarily unavailable",
    fallback_model: "legacy",
    ...legacyPayload,
  };
}

export async function GET(request) {
  const requestedModel = getRequestedModel(request);
  const confidenceOptions = getConfidenceOptions(request);
  const comparisonIdentifiers = getComparisonIdentifiers(request);

  try {
    const [legacyData, legacyRecords] = await Promise.all([
      fetchPromiseScoreSummaries(),
      fetchPromiseScoreRecords(),
    ]);
    const legacyPayload = buildLegacyPayload(legacyData, legacyRecords);

    if (requestedModel === "legacy") {
      return NextResponse.json(
        buildResponseBody({
          model: "legacy",
          legacyPayload,
        })
      );
    }

    let outcomePayload;

    try {
      const outcomeData = await computeOutcomeBasedScores(confidenceOptions);
      if (comparisonIdentifiers.length) {
        outcomeData.comparison = buildPresidentComparison(
          outcomeData.presidents || [],
          comparisonIdentifiers
        );
      }
      outcomePayload = buildOutcomePayload(outcomeData);
    } catch (outcomeError) {
      console.error("Error computing outcome-based promise scores:", outcomeError);
      outcomePayload = buildOutcomeErrorPayload();
    }

    if (requestedModel === "outcome") {
      if (outcomePayload.error) {
        return NextResponse.json(buildLegacyFallbackResponse(legacyPayload));
      }

      return NextResponse.json(
        buildResponseBody({
          model: "outcome",
          outcomePayload,
        })
      );
    }

    // Preserve the original top-level legacy payload so existing consumers
    // remain compatible while compare mode adds explicit parallel results.
    return NextResponse.json(
      buildResponseBody({
        model: "compare",
        legacyPayload,
        outcomePayload,
      })
    );
  } catch (error) {
    if (isPromiseTrackerSchemaMissing(error)) {
      const legacyPayload = buildEmptyLegacyPayload();

      if (requestedModel === "legacy") {
        return NextResponse.json(
          buildResponseBody({
            model: "legacy",
            legacyPayload,
          })
        );
      }

      const outcomePayload = buildOutcomeErrorPayload();

      if (requestedModel === "outcome") {
        return NextResponse.json(buildLegacyFallbackResponse(legacyPayload));
      }

      return NextResponse.json(
        buildResponseBody({
          model: "compare",
          legacyPayload,
          outcomePayload,
        })
      );
    }

    console.error("Error fetching promise scores:", error);
    return NextResponse.json(
      { error: "Failed to fetch promise scores" },
      { status: 500 }
    );
  }
}
