import { getDb } from "@/lib/db";
import { normalizeString, toSafeNumber } from "./shared.js";

const SAFE_CANONICAL_LINK_HINTS = new Map([
  [
    17,
    {
      promiseActionId: 120,
      expectedActionTitle: "Congress enacts the Ku Klux Klan Act",
      recommendedOperatorAction: "add related_policy_id to matching promise_action",
      note: "A current-admin promise action already names this policy explicitly but lacks the canonical related_policy_id link.",
    },
  ],
]);

export const SYSTEMIC_LINKAGE_REPORT_COLUMNS = [
  "policy_id",
  "title",
  "year_enacted",
  "systemic_impact_category",
  "systemic_impact_summary",
  "active_in_live_scoring",
  "report_status",
  "scoring_path_type",
  "linked_outcome_count",
  "final_report_active_outcomes",
  "public_service_active_outcomes",
  "judicial_active_outcomes",
  "canonical_link_status",
  "inactive_reason",
  "recommended_operator_action",
];

function isJudicialTitle(title) {
  const text = normalizeString(title);
  return /\bv\.\b/i.test(text) || /cases\s*\(\d{4}\)/i.test(text);
}

function humanizeToken(value) {
  const text = normalizeString(value);
  if (!text) {
    return "Unknown";
  }
  return text
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

async function fetchScalar(db, sql, params = []) {
  const [rows] = await db.query(sql, params);
  return toSafeNumber(rows?.[0]?.total, 0);
}

async function fetchRows(db, sql, params = []) {
  const [rows] = await db.query(sql, params);
  return Array.isArray(rows) ? rows : [];
}

async function fetchClassifiedPolicies(db) {
  const [rows] = await db.query(
    `
      SELECT
        id,
        title,
        year_enacted,
        policy_type,
        impact_direction,
        systemic_impact_category,
        systemic_impact_summary
      FROM policies
      WHERE COALESCE(is_archived, 0) = 0
        AND systemic_impact_category IS NOT NULL
        AND systemic_impact_category <> 'standard'
      ORDER BY year_enacted ASC, title ASC
    `
  );
  return Array.isArray(rows) ? rows : [];
}

async function fetchExplicitActionSamples(db, policyId) {
  return fetchRows(
    db,
    `
      SELECT
        pa.id,
        pa.promise_id,
        pa.title AS action_title,
        pr.slug AS promise_slug,
        pr.title AS promise_title
      FROM promise_actions pa
      JOIN promises pr ON pr.id = pa.promise_id
      WHERE pa.related_policy_id = ?
      ORDER BY pa.id ASC
      LIMIT 3
    `,
    [policyId]
  );
}

async function fetchExactTitleCandidateSamples(db, title) {
  return fetchRows(
    db,
    `
      SELECT
        pa.id,
        pa.promise_id,
        pa.title AS action_title,
        pr.slug AS promise_slug,
        pr.title AS promise_title
      FROM promise_actions pa
      JOIN promises pr ON pr.id = pa.promise_id
      WHERE pa.related_policy_id IS NULL
        AND (
          CONVERT(pa.title USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
          OR CONVERT(pa.description USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
        )
      ORDER BY pa.id ASC
      LIMIT 3
    `,
    [title, title]
  );
}

function serializeActionSamples(rows = []) {
  return rows.map((row) => ({
    promise_action_id: toSafeNumber(row.id, 0),
    promise_id: toSafeNumber(row.promise_id, 0),
    promise_slug: normalizeString(row.promise_slug) || null,
    promise_title: normalizeString(row.promise_title) || null,
    action_title: normalizeString(row.action_title) || null,
  }));
}

function deriveScoringPathType({
  finalReportActiveOutcomes,
  publicServiceActiveOutcomes,
  judicialActiveOutcomes,
  explicitActionLinks,
  exactTitleActionLinks,
}) {
  const hasCurrentAdminSignals =
    finalReportActiveOutcomes > 0 ||
    publicServiceActiveOutcomes > 0 ||
    explicitActionLinks > 0 ||
    exactTitleActionLinks > 0;
  const hasJudicialSignals = judicialActiveOutcomes > 0;

  if (hasCurrentAdminSignals && hasJudicialSignals) {
    return "mixed";
  }
  if (hasCurrentAdminSignals) {
    return "current_admin";
  }
  if (hasJudicialSignals) {
    return "judicial";
  }
  return "none";
}

function deriveReportStatus({
  finalReportActiveOutcomes,
  publicServiceActiveOutcomes,
  judicialActiveOutcomes,
  exactTitleActionLinks,
  explicitActionLinks,
}) {
  if (judicialActiveOutcomes > 0) {
    return "active";
  }
  if (finalReportActiveOutcomes > 0 && publicServiceActiveOutcomes > 0) {
    return "active";
  }
  if (finalReportActiveOutcomes > 0 || publicServiceActiveOutcomes > 0) {
    return "partial";
  }
  if (exactTitleActionLinks > 1) {
    return "manual_review";
  }
  if (exactTitleActionLinks === 1 || explicitActionLinks > 0) {
    return "blocked";
  }
  return "inactive";
}

function buildGuidance({
  policy,
  explicitActionLinks,
  exactTitleActionLinks,
  finalReportActiveOutcomes,
  publicServiceActiveOutcomes,
  judicialActiveOutcomes,
  rawCurrentAdminIdOverlap,
  rawLegislativeIdOverlap,
}) {
  const title = normalizeString(policy.title);
  const policyType = normalizeString(policy.policy_type);
  const safeHint = SAFE_CANONICAL_LINK_HINTS.get(toSafeNumber(policy.id, 0)) || null;
  const looksJudicial = isJudicialTitle(title) || policyType.toLowerCase().includes("judicial");
  const currentAdminSurfaceMismatch =
    (finalReportActiveOutcomes > 0 && publicServiceActiveOutcomes === 0) ||
    (publicServiceActiveOutcomes > 0 && finalReportActiveOutcomes === 0);

  if (judicialActiveOutcomes > 0) {
    return {
      activeInLiveScoring: true,
      canonicalLinkStatus: "judicial_direct_link",
      inactiveReason: null,
      inactiveReasonLabel: null,
      recommendedOperatorAction: "leave as-is; already active in live scoring",
      recommendedOperatorActionLabel: "Leave As-Is",
      inactiveReasonDetail:
        "This policy reaches live scoring through a direct judicial_impact outcome, not through promise-action linkage.",
    };
  }

  if (finalReportActiveOutcomes > 0 && publicServiceActiveOutcomes > 0) {
    if (explicitActionLinks > 0) {
      return {
        activeInLiveScoring: true,
        canonicalLinkStatus: "explicit_promise_action_link",
        inactiveReason: null,
        inactiveReasonLabel: null,
        recommendedOperatorAction: "leave as-is; already active in live scoring",
        recommendedOperatorActionLabel: "Leave As-Is",
        inactiveReasonDetail:
          "The active current-admin scoring path already resolves this policy through a canonical promise_actions.related_policy_id link.",
      };
    }
    return {
      activeInLiveScoring: true,
      canonicalLinkStatus: "runtime_title_match_only",
      inactiveReason: null,
      inactiveReasonLabel: null,
      recommendedOperatorAction: safeHint?.recommendedOperatorAction || "manual review of ambiguous linkage",
      recommendedOperatorActionLabel: safeHint ? "Promote Canonical Link" : "Manual Review",
      inactiveReasonDetail:
        "This policy contributes today through the runtime exact-title fallback, but the canonical related_policy_id link is still missing.",
    };
  }

  if (currentAdminSurfaceMismatch) {
    return {
      activeInLiveScoring: true,
      canonicalLinkStatus: explicitActionLinks > 0 ? "partial_current_admin_link" : "runtime_title_match_only",
      inactiveReason: "ambiguous_relation_requires_manual_review",
      inactiveReasonLabel: "Surface Mismatch Requires Review",
      recommendedOperatorAction: "manual review of ambiguous linkage",
      recommendedOperatorActionLabel: "Manual Review",
      inactiveReasonDetail:
        "One live score surface resolves this policy but the other does not. This needs review before treating the linkage as fully reliable.",
    };
  }

  if (exactTitleActionLinks > 1) {
    return {
      activeInLiveScoring: false,
      canonicalLinkStatus: "multiple_title_match_candidates",
      inactiveReason: "ambiguous_relation_requires_manual_review",
      inactiveReasonLabel: "Ambiguous Relation",
      recommendedOperatorAction: "manual review of ambiguous linkage",
      recommendedOperatorActionLabel: "Manual Review",
      inactiveReasonDetail:
        "Multiple unlinked promise actions mention the policy title, so the missing canonical relationship must be resolved manually.",
    };
  }

  if (exactTitleActionLinks === 1) {
    return {
      activeInLiveScoring: false,
      canonicalLinkStatus: "title_match_candidate_only",
      inactiveReason: "no_canonical_promise_action_link",
      inactiveReasonLabel: "Missing Canonical Promise Link",
      recommendedOperatorAction:
        safeHint?.recommendedOperatorAction || "add related_policy_id to matching promise_action",
      recommendedOperatorActionLabel: "Add Canonical Link",
      inactiveReasonDetail:
        safeHint?.note ||
        "A single unlinked promise action names this policy directly, but the canonical related_policy_id field is still missing.",
    };
  }

  if (explicitActionLinks > 0) {
    return {
      activeInLiveScoring: false,
      canonicalLinkStatus: "explicit_promise_action_link_without_scored_outcome",
      inactiveReason: "no_scored_outcome_for_policy",
      inactiveReasonLabel: "No Scored Outcome",
      recommendedOperatorAction: "verify whether this policy should have a scored outcome",
      recommendedOperatorActionLabel: "Verify Scored Outcome",
      inactiveReasonDetail:
        "The policy is canonically linked to one or more promise actions, but those links are not reaching an active scored policy_outcome row.",
    };
  }

  if (looksJudicial) {
    return {
      activeInLiveScoring: false,
      canonicalLinkStatus: "no_direct_judicial_score_path",
      inactiveReason: "judicial_policy_not_in_active_scored_row_set",
      inactiveReasonLabel: "Judicial Policy Not Scored",
      recommendedOperatorAction: "verify whether this policy should have a scored outcome",
      recommendedOperatorActionLabel: "Verify Judicial Outcome",
      inactiveReasonDetail:
        "This looks like a judicial policy/case, but no direct judicial_impact outcome currently carries it into the scored row set.",
    };
  }

  if (rawCurrentAdminIdOverlap > 0 || rawLegislativeIdOverlap > 0) {
    return {
      activeInLiveScoring: false,
      canonicalLinkStatus: "unsafe_numeric_id_overlap_only",
      inactiveReason: "intentionally_outside_current_score_family",
      inactiveReasonLabel: "Outside Current Score Family",
      recommendedOperatorAction: "leave as-is; currently outside score family",
      recommendedOperatorActionLabel: "Leave As-Is",
      inactiveReasonDetail:
        "The only apparent matches are numeric policy_id overlaps with current_admin or legislative outcome rows. Those are intentionally ignored because they are not canonical links.",
    };
  }

  return {
    activeInLiveScoring: false,
    canonicalLinkStatus: "no_canonical_link_detected",
    inactiveReason: "no_scored_outcome_for_policy",
    inactiveReasonLabel: "No Canonical Link",
    recommendedOperatorAction: "verify whether this policy should have a scored outcome",
    recommendedOperatorActionLabel: "Verify Scope",
    inactiveReasonDetail:
      "No canonical promise-action or judicial link was found for this policy in the active scoring path.",
  };
}

async function auditPolicy(db, policy) {
  const policyId = toSafeNumber(policy.id, 0);
  const title = normalizeString(policy.title);

  const [
    explicitActionLinks,
    exactTitleActionLinks,
    finalReportActiveOutcomes,
    publicServiceActiveOutcomes,
    judicialActiveOutcomes,
    rawCurrentAdminIdOverlap,
    rawLegislativeIdOverlap,
    explicitActionSamples,
    exactTitleCandidateSamples,
  ] = await Promise.all([
    fetchScalar(
      db,
      `
        SELECT COUNT(*) AS total
        FROM promise_actions
        WHERE related_policy_id = ?
      `,
      [policyId]
    ),
    fetchScalar(
      db,
      `
        SELECT COUNT(*) AS total
        FROM promise_actions
        WHERE related_policy_id IS NULL
          AND (
            CONVERT(title USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
            OR CONVERT(description USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
          )
      `,
      [title, title]
    ),
    fetchScalar(
      db,
      `
        SELECT COUNT(DISTINCT po.id) AS total
        FROM promise_actions pa
        JOIN policy_outcomes po
          ON po.policy_type = 'current_admin'
         AND po.policy_id = pa.promise_id
        WHERE (
          pa.related_policy_id = ?
          OR (
            pa.related_policy_id IS NULL
            AND (
              CONVERT(pa.title USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
              OR CONVERT(pa.description USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
            )
          )
        )
      `,
      [policyId, title, title]
    ),
    fetchScalar(
      db,
      `
        SELECT COUNT(DISTINCT uo.id) AS total
        FROM promise_actions pa
        JOIN promise_outcomes po
          ON po.promise_id = pa.promise_id
        JOIN policy_outcomes uo
          ON uo.policy_type = 'current_admin'
         AND uo.policy_id = pa.promise_id
         AND uo.outcome_summary_hash = SHA2(TRIM(po.outcome_summary), 256)
        WHERE (
          pa.related_policy_id = ?
          OR (
            pa.related_policy_id IS NULL
            AND (
              CONVERT(pa.title USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
              OR CONVERT(pa.description USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
            )
          )
        )
      `,
      [policyId, title, title]
    ),
    fetchScalar(
      db,
      `
        SELECT COUNT(*) AS total
        FROM policy_outcomes
        WHERE policy_type = 'judicial_impact'
          AND policy_id = ?
      `,
      [policyId]
    ),
    fetchScalar(
      db,
      `
        SELECT COUNT(*) AS total
        FROM policy_outcomes
        WHERE policy_type = 'current_admin'
          AND policy_id = ?
      `,
      [policyId]
    ),
    fetchScalar(
      db,
      `
        SELECT COUNT(*) AS total
        FROM policy_outcomes
        WHERE policy_type = 'legislative'
          AND policy_id = ?
      `,
      [policyId]
    ),
    fetchExplicitActionSamples(db, policyId),
    fetchExactTitleCandidateSamples(db, title),
  ]);

  const guidance = buildGuidance({
    policy,
    explicitActionLinks,
    exactTitleActionLinks,
    finalReportActiveOutcomes,
    publicServiceActiveOutcomes,
    judicialActiveOutcomes,
    rawCurrentAdminIdOverlap,
    rawLegislativeIdOverlap,
  });

  const reportStatus = deriveReportStatus({
    finalReportActiveOutcomes,
    publicServiceActiveOutcomes,
    judicialActiveOutcomes,
    exactTitleActionLinks,
    explicitActionLinks,
  });
  const scoringPathType = deriveScoringPathType({
    finalReportActiveOutcomes,
    publicServiceActiveOutcomes,
    judicialActiveOutcomes,
    explicitActionLinks,
    exactTitleActionLinks,
  });

  return {
    policy_id: policyId,
    title,
    year_enacted: toSafeNumber(policy.year_enacted, 0) || null,
    policy_type: normalizeString(policy.policy_type) || null,
    impact_direction: normalizeString(policy.impact_direction) || null,
    systemic_impact_category: normalizeString(policy.systemic_impact_category) || null,
    systemic_impact_summary: normalizeString(policy.systemic_impact_summary) || null,
    active_in_live_scoring: guidance.activeInLiveScoring,
    report_status: reportStatus,
    scoring_path_type: scoringPathType,
    linked_outcome_count: Math.max(finalReportActiveOutcomes, publicServiceActiveOutcomes) + judicialActiveOutcomes,
    final_report_active_outcomes: finalReportActiveOutcomes,
    public_service_active_outcomes: publicServiceActiveOutcomes,
    judicial_active_outcomes: judicialActiveOutcomes,
    explicit_action_link_count: explicitActionLinks,
    exact_title_candidate_action_count: exactTitleActionLinks,
    raw_current_admin_id_overlap: rawCurrentAdminIdOverlap,
    raw_legislative_id_overlap: rawLegislativeIdOverlap,
    canonical_link_status: guidance.canonicalLinkStatus,
    canonical_link_status_label: humanizeToken(guidance.canonicalLinkStatus),
    inactive_reason: guidance.inactiveReason,
    inactive_reason_label: guidance.inactiveReasonLabel,
    inactive_reason_detail: guidance.inactiveReasonDetail,
    recommended_operator_action: guidance.recommendedOperatorAction,
    recommended_operator_action_label: guidance.recommendedOperatorActionLabel,
    explicit_action_samples: serializeActionSamples(explicitActionSamples),
    exact_title_candidate_samples: serializeActionSamples(exactTitleCandidateSamples),
  };
}

export async function getSystemicLinkageOperatorReport() {
  const db = getDb();
  const policies = await fetchClassifiedPolicies(db);
  const rows = await Promise.all(policies.map((policy) => auditPolicy(db, policy)));

  const summary = rows.reduce(
    (bucket, row) => {
      bucket.classified_policy_count += 1;
      if (row.active_in_live_scoring) {
        bucket.active_policy_count += 1;
      } else {
        bucket.inactive_policy_count += 1;
      }
      if (row.report_status === "manual_review") {
        bucket.manual_review_count += 1;
      }
      if (row.report_status === "partial") {
        bucket.partial_surface_count += 1;
      }
      bucket.final_report_active_policy_count += row.final_report_active_outcomes > 0 ? 1 : 0;
      bucket.public_service_active_policy_count += row.public_service_active_outcomes > 0 ? 1 : 0;
      bucket.status_counts[row.report_status] = (bucket.status_counts[row.report_status] || 0) + 1;
      if (row.inactive_reason) {
        bucket.inactive_reason_counts[row.inactive_reason] =
          (bucket.inactive_reason_counts[row.inactive_reason] || 0) + 1;
      }
      bucket.recommended_action_counts[row.recommended_operator_action] =
        (bucket.recommended_action_counts[row.recommended_operator_action] || 0) + 1;
      return bucket;
    },
    {
      classified_policy_count: 0,
      active_policy_count: 0,
      inactive_policy_count: 0,
      manual_review_count: 0,
      partial_surface_count: 0,
      final_report_active_policy_count: 0,
      public_service_active_policy_count: 0,
      status_counts: {},
      inactive_reason_counts: {},
      recommended_action_counts: {},
    }
  );

  return {
    generated_at: new Date().toISOString(),
    workflow: "systemic_linkage_operator_report",
    report_columns: SYSTEMIC_LINKAGE_REPORT_COLUMNS,
    summary: {
      ...summary,
      status_counts: Object.fromEntries(
        Object.entries(summary.status_counts).sort((left, right) => left[0].localeCompare(right[0]))
      ),
      inactive_reason_counts: Object.fromEntries(
        Object.entries(summary.inactive_reason_counts).sort((left, right) => left[0].localeCompare(right[0]))
      ),
      recommended_action_counts: Object.fromEntries(
        Object.entries(summary.recommended_action_counts).sort((left, right) => left[0].localeCompare(right[0]))
      ),
    },
    rows: rows.sort((left, right) => {
      if (left.active_in_live_scoring !== right.active_in_live_scoring) {
        return left.active_in_live_scoring ? 1 : -1;
      }
      if (left.report_status !== right.report_status) {
        return left.report_status.localeCompare(right.report_status);
      }
      return (left.year_enacted || 0) - (right.year_enacted || 0) || left.title.localeCompare(right.title);
    }),
  };
}
