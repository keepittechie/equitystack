function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

export const TRUST_STATES = Object.freeze({
  VERIFIED: "Verified",
  GUARDED: "Guarded",
  NEEDS_REVIEW: "Needs Review",
  PENDING: "Pending",
});

export const IMPACT_DIRECTIONS = Object.freeze({
  POSITIVE: "Positive",
  NEGATIVE: "Negative",
  MIXED: "Mixed",
  BLOCKED: "Blocked",
  UNCLEAR: "Unclear",
});

export const EVIDENCE_STRENGTHS = Object.freeze({
  STRONG: "Strong",
  MODERATE: "Moderate",
  LIMITED: "Limited",
  MISSING: "Missing",
});

export const SOURCE_COVERAGE = Object.freeze({
  COMPLETE: "Complete",
  PARTIAL: "Partial",
  MISSING: "Missing",
});

export const REVIEW_STATES = Object.freeze({
  PENDING: "Pending Review",
  MANUAL_REQUIRED: "Manual Review Required",
  REVIEWED: "Reviewed",
  BLOCKED: "Blocked",
});

export const AI_STATES = Object.freeze({
  SUCCEEDED: "AI Succeeded",
  PARTIAL: "AI Partial",
  FAILED: "AI Failed",
  NOT_STARTED: "Not Started",
});

export const CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  UNKNOWN: "Unknown",
});

export function toCanonicalTrustState(value) {
  const normalized = normalizeLower(value);

  if (!normalized || ["pending", "not started", "not_started", "unknown"].includes(normalized)) {
    return TRUST_STATES.PENDING;
  }

  if (
    [
      "verified",
      "high",
      "healthy",
      "passed",
    ].includes(normalized)
  ) {
    return TRUST_STATES.VERIFIED;
  }

  if (
    [
      "guarded",
      "medium",
      "partial",
      "needs verification",
      "warning",
    ].includes(normalized)
  ) {
    return TRUST_STATES.GUARDED;
  }

  if (
    [
      "needs review",
      "low",
      "critical",
      "failed",
      "trust warning",
    ].includes(normalized)
  ) {
    return TRUST_STATES.NEEDS_REVIEW;
  }

  return TRUST_STATES.PENDING;
}

export function toCanonicalImpactDirection(value) {
  const normalized = normalizeLower(value);

  if (normalized === "positive") {
    return IMPACT_DIRECTIONS.POSITIVE;
  }
  if (normalized === "negative") {
    return IMPACT_DIRECTIONS.NEGATIVE;
  }
  if (normalized === "mixed" || normalized === "mixed impact") {
    return IMPACT_DIRECTIONS.MIXED;
  }
  if (normalized === "blocked" || normalized === "blocked/unrealized") {
    return IMPACT_DIRECTIONS.BLOCKED;
  }

  return IMPACT_DIRECTIONS.UNCLEAR;
}

export function toCanonicalEvidenceStrength(value) {
  const normalized = normalizeLower(value);

  if (normalized === "strong" || normalized === "high") {
    return EVIDENCE_STRENGTHS.STRONG;
  }
  if (normalized === "moderate" || normalized === "medium") {
    return EVIDENCE_STRENGTHS.MODERATE;
  }
  if (normalized === "limited" || normalized === "low") {
    return EVIDENCE_STRENGTHS.LIMITED;
  }

  return EVIDENCE_STRENGTHS.MISSING;
}

export function toCanonicalSourceCoverage(value) {
  const normalized = normalizeLower(value);

  if (["complete", "full"].includes(normalized)) {
    return SOURCE_COVERAGE.COMPLETE;
  }
  if (["partial", "good", "incomplete"].includes(normalized)) {
    return SOURCE_COVERAGE.PARTIAL;
  }

  return SOURCE_COVERAGE.MISSING;
}

export function toCanonicalReviewState(value) {
  const normalized = normalizeLower(value);

  if (normalized === "blocked") {
    return REVIEW_STATES.BLOCKED;
  }
  if (
    [
      "manual review required",
      "manual_review_required",
      "manual review",
      "needs review",
      "needs_review",
    ].includes(normalized)
  ) {
    return REVIEW_STATES.MANUAL_REQUIRED;
  }
  if (
    [
      "reviewed",
      "complete",
      "completed",
      "approved",
      "dismissed",
      "finalized",
    ].includes(normalized)
  ) {
    return REVIEW_STATES.REVIEWED;
  }

  return REVIEW_STATES.PENDING;
}

export function toCanonicalAiState(value) {
  const normalized = normalizeLower(value);

  if (!normalized || ["pending", "not started", "not_started", "unknown"].includes(normalized)) {
    return AI_STATES.NOT_STARTED;
  }
  if (["success", "succeeded", "ai succeeded"].includes(normalized)) {
    return AI_STATES.SUCCEEDED;
  }
  if (["partial", "ai partial"].includes(normalized)) {
    return AI_STATES.PARTIAL;
  }
  if (["failed", "error", "heuristic_fallback", "ai failed"].includes(normalized)) {
    return AI_STATES.FAILED;
  }

  return AI_STATES.NOT_STARTED;
}

export function toCanonicalConfidence(value) {
  const normalized = normalizeLower(value);

  if (normalized === "high") {
    return CONFIDENCE_LEVELS.HIGH;
  }
  if (normalized === "medium" || normalized === "moderate") {
    return CONFIDENCE_LEVELS.MEDIUM;
  }
  if (normalized === "low") {
    return CONFIDENCE_LEVELS.LOW;
  }

  return CONFIDENCE_LEVELS.UNKNOWN;
}

export function getTrustStateTone(label) {
  if (label === TRUST_STATES.VERIFIED) {
    return "success";
  }
  if (label === TRUST_STATES.GUARDED) {
    return "warning";
  }
  if (label === TRUST_STATES.NEEDS_REVIEW) {
    return "danger";
  }
  return "default";
}

export function getImpactDirectionTone(label) {
  if (label === IMPACT_DIRECTIONS.POSITIVE) {
    return "success";
  }
  if (label === IMPACT_DIRECTIONS.NEGATIVE) {
    return "danger";
  }
  if (label === IMPACT_DIRECTIONS.MIXED || label === IMPACT_DIRECTIONS.UNCLEAR) {
    return "warning";
  }
  return "default";
}

export function getEvidenceStrengthTone(label) {
  if (label === EVIDENCE_STRENGTHS.STRONG) {
    return "success";
  }
  if (label === EVIDENCE_STRENGTHS.MODERATE || label === EVIDENCE_STRENGTHS.LIMITED) {
    return "warning";
  }
  return "danger";
}

export function getSourceCoverageTone(label) {
  if (label === SOURCE_COVERAGE.COMPLETE) {
    return "success";
  }
  if (label === SOURCE_COVERAGE.PARTIAL) {
    return "warning";
  }
  return "danger";
}

export function getAiStateTone(label) {
  if (label === AI_STATES.SUCCEEDED) {
    return "success";
  }
  if (label === AI_STATES.PARTIAL) {
    return "warning";
  }
  if (label === AI_STATES.FAILED) {
    return "danger";
  }
  return "default";
}

export function getConfidenceTone(label) {
  if (label === CONFIDENCE_LEVELS.HIGH) {
    return "success";
  }
  if (label === CONFIDENCE_LEVELS.MEDIUM) {
    return "warning";
  }
  if (label === CONFIDENCE_LEVELS.LOW) {
    return "danger";
  }
  return "default";
}

export function getRecordImpactDirectionLabel(record = {}) {
  return toCanonicalImpactDirection(
    record.impact_direction_for_curation ||
      record.latest_impact_direction ||
      record.impact_direction ||
      ""
  );
}

export function getRecordEvidenceStrengthLabel(record = {}) {
  const evidenceLabel = toCanonicalEvidenceStrength(
    record.latest_evidence_strength || record.evidence_strength || ""
  );

  if (evidenceLabel !== EVIDENCE_STRENGTHS.MISSING) {
    return evidenceLabel;
  }

  return Number(record.source_count || 0) > 0
    ? EVIDENCE_STRENGTHS.LIMITED
    : EVIDENCE_STRENGTHS.MISSING;
}

export function getRecordSourceCoverageLabel(record = {}) {
  const sourceCount = Number(record.source_count || 0);
  const outcomeCount = Number(record.outcome_count || 0);

  if (sourceCount <= 0) {
    return SOURCE_COVERAGE.MISSING;
  }
  if (outcomeCount > 0 && sourceCount >= outcomeCount) {
    return SOURCE_COVERAGE.COMPLETE;
  }
  return SOURCE_COVERAGE.PARTIAL;
}

export function getRecordTrustStateLabel(record = {}) {
  const impactDirection = getRecordImpactDirectionLabel(record);
  const evidenceStrength = getRecordEvidenceStrengthLabel(record);
  const sourceCoverage = getRecordSourceCoverageLabel(record);

  if (
    sourceCoverage === SOURCE_COVERAGE.COMPLETE &&
    impactDirection !== IMPACT_DIRECTIONS.UNCLEAR &&
    [EVIDENCE_STRENGTHS.STRONG, EVIDENCE_STRENGTHS.MODERATE].includes(evidenceStrength)
  ) {
    return TRUST_STATES.VERIFIED;
  }

  if (
    sourceCoverage === SOURCE_COVERAGE.MISSING ||
    evidenceStrength === EVIDENCE_STRENGTHS.MISSING
  ) {
    return TRUST_STATES.NEEDS_REVIEW;
  }

  return TRUST_STATES.GUARDED;
}

export function toCanonicalCompletenessLabel(value) {
  const normalized = normalizeLower(value);

  if (normalized === "complete") {
    return "Complete";
  }
  if (normalized === "good" || normalized === "partial") {
    return "Partial";
  }
  if (normalized === "needs review" || normalized === "needs_review") {
    return TRUST_STATES.NEEDS_REVIEW;
  }

  return TRUST_STATES.NEEDS_REVIEW;
}
