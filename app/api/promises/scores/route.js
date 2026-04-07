import { NextResponse } from "next/server";
import {
  fetchPromiseScoreRecords,
  fetchPromiseScoreSummaries,
} from "@/lib/services/promiseService";
import { computeOutcomeBasedScores } from "@/lib/services/blackImpactScoreService";
import { getBlackImpactScoreMethodology } from "@/lib/black-impact-score/methodology.js";

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
    metadata: data?.metadata ?? {
      total_promises: 0,
      total_outcomes: 0,
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
      const outcomeData = await computeOutcomeBasedScores();
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
