import {
  getEvidenceStrengthTone,
  getImpactDirectionTone,
  toCanonicalCompletenessLabel,
  toCanonicalEvidenceStrength,
  toCanonicalImpactDirection,
} from "@/lib/labels";
import {
  describeScoreEligibility,
  describeVisibilityState,
  formatScoreEligibilityLabel,
  formatSourceQualityLabel,
} from "@/lib/currentAdmin/governingActions";

export function statusPillClasses(tone = "default", extraClasses = "") {
  const toneMap = {
    success: "status-pill--success",
    warning: "status-pill--warning",
    danger: "status-pill--danger",
    info: "status-pill--info",
    cyan: "status-pill--cyan",
    violet: "status-pill--violet",
    accent: "status-pill--accent",
    default: "status-pill--default",
  };
  const toneClass = toneMap[tone] || toneMap.default;
  return ["status-pill", toneClass, extraClasses].filter(Boolean).join(" ");
}

export function EvidenceBadge({ summary }) {
  if (!summary) return null;

  const label = toCanonicalEvidenceStrength(summary.evidence_strength);

  return <span className={statusPillClasses(getEvidenceStrengthTone(label))}>Evidence: {label}</span>;
}

export function CompletenessBadge({ summary }) {
  if (!summary) return null;

  const label = toCanonicalCompletenessLabel(summary.status);
  const tone =
    label === "Complete"
      ? "success"
      : label === "Partial"
        ? "warning"
        : "danger";

  return <span className={statusPillClasses(tone)}>Data Quality: {label}</span>;
}

export function ImpactBadge({ impact }) {
  if (!impact) return null;

  const canonicalImpact = toCanonicalImpactDirection(impact);
  const label = canonicalImpact === "Mixed" ? "Mixed Impact" : canonicalImpact;

  return <span className={statusPillClasses(getImpactDirectionTone(canonicalImpact))}>{label}</span>;
}

export function PromiseStatusBadge({ status }) {
  if (!status) return null;

  let tone = "default";

  if (status === "Delivered") {
    tone = "success";
  } else if (status === "In Progress") {
    tone = "info";
  } else if (status === "Partial") {
    tone = "warning";
  } else if (status === "Failed") {
    tone = "danger";
  }

  return <span className={statusPillClasses(tone)}>{status}</span>;
}

export function PromiseRelevanceBadge({ relevance }) {
  if (!relevance) return null;

  let tone = "default";

  if (relevance === "High") {
    tone = "info";
  } else if (relevance === "Medium") {
    tone = "cyan";
  }

  return <span className={statusPillClasses(tone)}>{relevance} relevance</span>;
}

export function PromiseImpactDirectionBadge({ impact }) {
  if (!impact) return null;

  const canonicalImpact = toCanonicalImpactDirection(impact);
  const label = canonicalImpact === "Mixed" ? "Mixed Impact" : canonicalImpact;

  return <span className={statusPillClasses(getImpactDirectionTone(canonicalImpact))}>{label}</span>;
}

function humanizeToken(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function SourceQualityBadge({ quality }) {
  if (!quality) return null;
  const normalized = String(quality).toLowerCase();
  const tone =
    normalized === "primary_official"
      ? "success"
      : normalized === "secondary_verified"
        ? "info"
        : "warning";
  return (
    <span
      className={statusPillClasses(tone)}
      title={`${formatSourceQualityLabel(quality)} sources support this public record state.`}
    >
      Source: {humanizeToken(quality)}
    </span>
  );
}

export function ScoreEligibilityBadge({ value }) {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  const tone =
    normalized === "scored"
      ? "success"
      : normalized === "eligible"
        ? "info"
        : normalized === "hold_for_evidence"
          ? "warning"
          : "default";
  return (
    <span className={statusPillClasses(tone)} title={describeScoreEligibility(value)}>
      Score: {formatScoreEligibilityLabel(value)}
    </span>
  );
}

export function GoverningActionStatusBadge({ status }) {
  if (!status) return null;
  const normalized = String(status).toLowerCase();
  const tone =
    normalized === "implemented" || normalized === "active"
      ? "success"
      : normalized.includes("block")
        ? "warning"
        : normalized === "rescinded" || normalized === "abandoned"
          ? "danger"
          : "default";
  return <span className={statusPillClasses(tone)}>{humanizeToken(status)}</span>;
}

export function GoverningActionTypeBadge({ type }) {
  if (!type) return null;
  return <span className={statusPillClasses("info")}>{humanizeToken(type)}</span>;
}

export function VisibilityStateBadge({ value }) {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  const tone =
    normalized === "public_scored"
      ? "success"
      : normalized === "public_unscored"
        ? "info"
        : normalized === "admin_review"
          ? "warning"
          : "default";
  return (
    <span className={statusPillClasses(tone)} title={describeVisibilityState(value)}>
      Visibility: {humanizeToken(value)}
    </span>
  );
}
