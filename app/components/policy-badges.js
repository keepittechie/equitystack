export function EvidenceBadge({ summary }) {
  if (!summary) return null;

  const label = summary.evidence_strength;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (label === "Strong") {
    className += "bg-green-50 text-green-700 border-green-200";
  } else if (label === "Moderate") {
    className += "bg-yellow-50 text-yellow-700 border-yellow-200";
  } else {
    className += "bg-red-50 text-red-700 border-red-200";
  }

  return <span className={className}>Evidence: {label}</span>;
}

export function CompletenessBadge({ summary }) {
  if (!summary) return null;

  const label = summary.status;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (label === "Complete") {
    className += "bg-green-50 text-green-700 border-green-200";
  } else if (label === "Good") {
    className += "bg-blue-50 text-blue-700 border-blue-200";
  } else {
    className += "bg-orange-50 text-orange-700 border-orange-200";
  }

  return <span className={className}>Data Quality: {label}</span>;
}

export function ImpactBadge({ impact }) {
  if (!impact) return null;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (impact === "Positive") {
    className += "bg-green-50 text-green-700 border-green-200";
  } else if (impact === "Negative") {
    className += "bg-red-50 text-red-700 border-red-200";
  } else if (impact === "Mixed") {
    className += "bg-yellow-50 text-yellow-700 border-yellow-200";
  } else if (impact === "Blocked") {
    className += "bg-stone-100 text-stone-700 border-stone-300";
  } else {
    className += "bg-stone-100 text-stone-700 border-stone-300";
  }

  return <span className={className}>{impact}</span>;
}

export function PromiseStatusBadge({ status }) {
  if (!status) return null;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (status === "Delivered") {
    className += "bg-green-50 text-green-700 border-green-200";
  } else if (status === "In Progress") {
    className += "bg-blue-50 text-blue-700 border-blue-200";
  } else if (status === "Partial") {
    className += "bg-yellow-50 text-yellow-700 border-yellow-200";
  } else if (status === "Failed") {
    className += "bg-red-50 text-red-700 border-red-200";
  } else if (status === "Blocked") {
    className += "bg-stone-100 text-stone-700 border-stone-300";
  } else {
    className += "bg-stone-100 text-stone-700 border-stone-300";
  }

  return <span className={className}>{status}</span>;
}

export function PromiseRelevanceBadge({ relevance }) {
  if (!relevance) return null;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (relevance === "High") {
    className += "bg-[rgba(120,53,15,0.08)] text-[var(--accent)] border-[rgba(120,53,15,0.18)]";
  } else if (relevance === "Medium") {
    className += "bg-blue-50 text-blue-700 border-blue-200";
  } else {
    className += "bg-stone-100 text-stone-700 border-stone-300";
  }

  return <span className={className}>{relevance} relevance</span>;
}

export function PromiseImpactDirectionBadge({ impact }) {
  if (!impact) return null;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (impact === "Positive") {
    className += "bg-green-50 text-green-700 border-green-200";
  } else if (impact === "Negative") {
    className += "bg-red-50 text-red-700 border-red-200";
  } else if (impact === "Blocked/Unrealized") {
    className += "bg-stone-100 text-stone-700 border-stone-300";
  } else {
    className += "bg-yellow-50 text-yellow-700 border-yellow-200";
  }

  return <span className={className}>{impact}</span>;
}
