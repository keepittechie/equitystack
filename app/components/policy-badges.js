export function EvidenceBadge({ summary }) {
  if (!summary) return null;

  const label = summary.evidence_strength;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (label === "Strong") {
    className += "bg-[rgba(22,163,74,0.1)] text-[#166534] border-[rgba(22,163,74,0.2)]";
  } else if (label === "Moderate") {
    className += "bg-[rgba(217,119,6,0.1)] text-[#b45309] border-[rgba(217,119,6,0.2)]";
  } else {
    className += "bg-[rgba(220,38,38,0.1)] text-[#b91c1c] border-[rgba(220,38,38,0.2)]";
  }

  return <span className={className}>Evidence: {label}</span>;
}

export function CompletenessBadge({ summary }) {
  if (!summary) return null;

  const label = summary.status;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (label === "Complete") {
    className += "bg-[rgba(22,163,74,0.1)] text-[#166534] border-[rgba(22,163,74,0.2)]";
  } else if (label === "Good") {
    className += "bg-[rgba(37,99,235,0.1)] text-[#1d4ed8] border-[rgba(37,99,235,0.2)]";
  } else {
    className += "bg-[rgba(217,119,6,0.1)] text-[#b45309] border-[rgba(217,119,6,0.2)]";
  }

  return <span className={className}>Data Quality: {label}</span>;
}

export function ImpactBadge({ impact }) {
  if (!impact) return null;

  const label = impact === "Mixed" ? "Mixed Impact" : impact;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (impact === "Positive") {
    className += "bg-[rgba(22,163,74,0.1)] text-[#166534] border-[rgba(22,163,74,0.2)]";
  } else if (impact === "Negative") {
    className += "bg-[rgba(220,38,38,0.1)] text-[#b91c1c] border-[rgba(220,38,38,0.2)]";
  } else if (impact === "Mixed") {
    className += "bg-[rgba(217,119,6,0.1)] text-[#b45309] border-[rgba(217,119,6,0.2)]";
  } else if (impact === "Blocked") {
    className += "bg-slate-100 text-slate-700 border-slate-300";
  } else {
    className += "bg-slate-100 text-slate-700 border-slate-300";
  }

  return <span className={className}>{label}</span>;
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

  const label = impact === "Mixed" ? "Mixed Impact" : impact;

  let className =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ";

  if (impact === "Positive") {
    className += "bg-[rgba(22,163,74,0.1)] text-[#166534] border-[rgba(22,163,74,0.2)]";
  } else if (impact === "Negative") {
    className += "bg-[rgba(220,38,38,0.1)] text-[#b91c1c] border-[rgba(220,38,38,0.2)]";
  } else if (impact === "Blocked/Unrealized") {
    className += "bg-slate-100 text-slate-700 border-slate-300";
  } else {
    className += "bg-[rgba(217,119,6,0.1)] text-[#b45309] border-[rgba(217,119,6,0.2)]";
  }

  return <span className={className}>{label}</span>;
}
