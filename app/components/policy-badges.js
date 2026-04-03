import {
  getEvidenceStrengthTone,
  getImpactDirectionTone,
  toCanonicalCompletenessLabel,
  toCanonicalEvidenceStrength,
  toCanonicalImpactDirection,
} from "@/lib/labels";

function pillClasses(tone) {
  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (tone === "success") {
    className += "bg-[rgba(22,163,74,0.1)] text-[#166534] border-[rgba(22,163,74,0.2)]";
  } else if (tone === "warning") {
    className += "bg-[rgba(217,119,6,0.1)] text-[#b45309] border-[rgba(217,119,6,0.2)]";
  } else if (tone === "danger") {
    className += "bg-[rgba(220,38,38,0.1)] text-[#b91c1c] border-[rgba(220,38,38,0.2)]";
  } else {
    className += "bg-slate-100 text-slate-700 border-slate-300";
  }

  return className;
}

export function EvidenceBadge({ summary }) {
  if (!summary) return null;

  const label = toCanonicalEvidenceStrength(summary.evidence_strength);

  return <span className={pillClasses(getEvidenceStrengthTone(label))}>Evidence: {label}</span>;
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

  return <span className={pillClasses(tone)}>Data Quality: {label}</span>;
}

export function ImpactBadge({ impact }) {
  if (!impact) return null;

  const canonicalImpact = toCanonicalImpactDirection(impact);
  const label = canonicalImpact === "Mixed" ? "Mixed Impact" : canonicalImpact;

  return <span className={pillClasses(getImpactDirectionTone(canonicalImpact))}>{label}</span>;
}

export function PromiseStatusBadge({ status }) {
  if (!status) return null;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (status === "Delivered") {
    className += "bg-[rgba(22,163,74,0.1)] text-[#166534] border-[rgba(22,163,74,0.2)]";
  } else if (status === "In Progress") {
    className += "bg-[rgba(37,99,235,0.1)] text-[#1d4ed8] border-[rgba(37,99,235,0.2)]";
  } else if (status === "Partial") {
    className += "bg-[rgba(217,119,6,0.1)] text-[#b45309] border-[rgba(217,119,6,0.2)]";
  } else if (status === "Failed") {
    className += "bg-[rgba(220,38,38,0.1)] text-[#b91c1c] border-[rgba(220,38,38,0.2)]";
  } else if (status === "Blocked") {
    className += "bg-slate-100 text-slate-700 border-slate-300";
  } else {
    className += "bg-slate-100 text-slate-700 border-slate-300";
  }

  return <span className={className}>{status}</span>;
}

export function PromiseRelevanceBadge({ relevance }) {
  if (!relevance) return null;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (relevance === "High") {
    className += "bg-[rgba(37,99,235,0.1)] text-[#1d4ed8] border-[rgba(37,99,235,0.2)]";
  } else if (relevance === "Medium") {
    className += "bg-[rgba(6,182,212,0.1)] text-[#0f766e] border-[rgba(6,182,212,0.2)]";
  } else {
    className += "bg-slate-100 text-slate-700 border-slate-300";
  }

  return <span className={className}>{relevance} relevance</span>;
}

export function PromiseImpactDirectionBadge({ impact }) {
  if (!impact) return null;

  const canonicalImpact = toCanonicalImpactDirection(impact);
  const label = canonicalImpact === "Mixed" ? "Mixed Impact" : canonicalImpact;

  return <span className={pillClasses(getImpactDirectionTone(canonicalImpact))}>{label}</span>;
}
