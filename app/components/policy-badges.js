import {
  getEvidenceStrengthTone,
  getImpactDirectionTone,
  toCanonicalCompletenessLabel,
  toCanonicalEvidenceStrength,
  toCanonicalImpactDirection,
} from "@/lib/labels";

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
