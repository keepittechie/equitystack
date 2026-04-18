import { query } from "@/lib/db";
import { buildBillDetailHref } from "@/lib/public-bills";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const EVIDENCE_STRENGTH_RANK = {
  Strong: 3,
  Moderate: 2,
  Weak: 1,
};

function toNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function compareDateDesc(left, right) {
  return String(right || "").localeCompare(String(left || ""));
}

function compareRankedRows(left, right, direction) {
  const leftScore = Number(left.impact_score || 0);
  const rightScore = Number(right.impact_score || 0);
  const scoreDiff =
    direction === "Negative" ? leftScore - rightScore : rightScore - leftScore;
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const evidenceDiff =
    (EVIDENCE_STRENGTH_RANK[right.evidence_strength] || 0) -
    (EVIDENCE_STRENGTH_RANK[left.evidence_strength] || 0);
  if (evidenceDiff !== 0) {
    return evidenceDiff;
  }

  const confidenceDiff =
    Number(right.confidence_score ?? -1) - Number(left.confidence_score ?? -1);
  if (confidenceDiff !== 0) {
    return confidenceDiff;
  }

  const sourceDiff = Number(right.source_count || 0) - Number(left.source_count || 0);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }

  const dateDiff = compareDateDesc(left.date, right.date);
  if (dateDiff !== 0) {
    return dateDiff;
  }

  return Number(right.id || 0) - Number(left.id || 0);
}

function compareMixedRows(left, right) {
  const scoreDiff =
    Math.abs(Number(right.impact_score || 0)) -
    Math.abs(Number(left.impact_score || 0));
  if (scoreDiff !== 0) {
    return scoreDiff;
  }
  return compareRankedRows(left, right, "Positive");
}

function buildLinkedRecord(row) {
  if (row.policy_type === "current_admin") {
    const promiseTitle = normalizeText(row.promise_title) || "Promise record";
    const promiseSlug = normalizeText(row.promise_slug);
    return {
      linked_record_title: promiseTitle,
      linked_record_type: "Promise",
      linked_record_href: promiseSlug ? `/promises/${promiseSlug}` : null,
    };
  }

  const billTitle = normalizeText(row.bill_title);
  const billNumber = normalizeText(row.bill_number);
  const linkedRecordTitle =
    billTitle && billNumber ? `${billNumber} • ${billTitle}` : billTitle || billNumber || "Tracked bill";

  return {
    linked_record_title: linkedRecordTitle,
    linked_record_type: "Bill",
    linked_record_href:
      row.tracked_bill_id != null
        ? buildBillDetailHref({
            id: row.tracked_bill_id,
            billNumber: row.bill_number,
            title: row.bill_title,
          })
        : null,
  };
}

function normalizeDashboardPolicyRow(row) {
  const linkedRecord = buildLinkedRecord(row);
  return {
    id: Number(row.id),
    title:
      normalizeText(row.outcome_summary) ||
      linkedRecord.linked_record_title ||
      `Policy outcome ${row.id}`,
    summary:
      normalizeText(row.measurable_impact) ||
      normalizeText(row.outcome_type) ||
      null,
    date: row.impact_start_date ?? null,
    impact_direction: normalizeText(row.impact_direction) || null,
    impact_score: Number(row.impact_score || 0),
    evidence_strength: normalizeText(row.evidence_strength) || null,
    confidence_score: toNumberOrNull(row.confidence_score),
    source_count: Number(row.source_count || 0),
    source_quality: normalizeText(row.source_quality) || null,
    status: normalizeText(row.status) || null,
    policy_type: normalizeText(row.policy_type) || null,
    record_type: "Policy outcome",
    ...linkedRecord,
  };
}

export async function fetchDashboardPolicyRankings({
  perDirection = 5,
  latestLimit = 10,
  mixedLimit = 5,
} = {}) {
  const rows = await query(
    `
    SELECT
      po.id,
      po.policy_type,
      po.policy_id,
      po.outcome_summary,
      po.outcome_type,
      po.measurable_impact,
      po.impact_direction,
      po.impact_score,
      po.evidence_strength,
      po.confidence_score,
      po.source_count,
      po.source_quality,
      po.status,
      po.impact_start_date,
      p.slug AS promise_slug,
      p.title AS promise_title,
      tb.id AS tracked_bill_id,
      tb.bill_number,
      tb.title AS bill_title
    FROM policy_outcomes po
    LEFT JOIN promises p
      ON po.policy_type = 'current_admin'
     AND p.id = po.policy_id
    LEFT JOIN tracked_bills tb
      ON po.policy_type = 'legislative'
     AND tb.id = po.policy_id
    WHERE po.policy_type IN ('current_admin', 'legislative')
      AND po.impact_score IS NOT NULL
      AND po.source_count > 0
      AND po.impact_direction IN ('Positive', 'Negative', 'Mixed', 'Blocked')
      AND (
        (po.policy_type = 'current_admin' AND p.id IS NOT NULL AND COALESCE(p.is_demo, 0) = 0)
        OR
        (po.policy_type = 'legislative' AND tb.id IS NOT NULL AND COALESCE(tb.active, 1) = 1)
      )
    ORDER BY po.impact_start_date DESC, po.id DESC
    `
  );

  const records = rows.map(normalizeDashboardPolicyRow);
  const topPositivePolicies = records
    .filter((row) => row.impact_direction === "Positive")
    .sort((left, right) => compareRankedRows(left, right, "Positive"))
    .slice(0, perDirection);
  const topNegativePolicies = records
    .filter((row) => row.impact_direction === "Negative")
    .sort((left, right) => compareRankedRows(left, right, "Negative"))
    .slice(0, perDirection);
  const topMixedPolicies = records
    .filter((row) => row.impact_direction === "Mixed")
    .sort(compareMixedRows)
    .slice(0, mixedLimit);
  const latestPolicyUpdates = records
    .slice()
    .sort((left, right) => {
      const dateDiff = compareDateDesc(left.date, right.date);
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return Number(right.id || 0) - Number(left.id || 0);
    })
    .slice(0, latestLimit);

  return {
    records,
    topPositivePolicies,
    topNegativePolicies,
    topMixedPolicies,
    latestPolicyUpdates,
  };
}
