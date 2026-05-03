function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function titleCaseLabel(value) {
  return String(value || "")
    .trim()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRelationshipPriority(value) {
  const normalized = normalizeLabel(value);
  if (normalized === "followed_by" || normalized === "builds_on") return 1;
  if (normalized === "expands" || normalized === "enables") return 2;
  if (normalized === "responds_to" || normalized === "replaces") return 3;
  if (normalized === "limited_by" || normalized === "restricts" || normalized === "undermines") return 4;
  return 5;
}

export function formatPolicyRelationshipTypeLabel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Related policy";
  }

  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getPolicyRelationshipTone(value) {
  const normalized = normalizeLabel(value);

  if (
    normalized.includes("expand") ||
    normalized.includes("enable") ||
    normalized.includes("builds_on") ||
    normalized.includes("followed_by")
  ) {
    return "success";
  }

  if (
    normalized.includes("restrict") ||
    normalized.includes("undermine") ||
    normalized.includes("limited_by")
  ) {
    return "danger";
  }

  if (
    normalized.includes("replace") ||
    normalized.includes("responds_to")
  ) {
    return "warning";
  }

  return "info";
}

export function getPolicyTemporalContextLabel(relatedYear, currentYear) {
  const resolvedRelatedYear = Number(relatedYear);
  const resolvedCurrentYear = Number(currentYear);

  if (!Number.isFinite(resolvedRelatedYear) || !Number.isFinite(resolvedCurrentYear)) {
    return null;
  }

  if (resolvedRelatedYear < resolvedCurrentYear) {
    return "Earlier record";
  }

  if (resolvedRelatedYear > resolvedCurrentYear) {
    return "Later record";
  }

  return "Same-year context";
}

export function summarizePolicyRelationshipContinuity(relationships = []) {
  const types = new Set(
    (relationships || [])
      .map((item) => normalizeLabel(item?.relationship_type))
      .filter(Boolean)
  );

  const hasExpansion =
    types.has("expands") ||
    types.has("enables") ||
    types.has("builds_on") ||
    types.has("followed_by");
  const hasConstraint =
    types.has("restricts") ||
    types.has("undermines") ||
    types.has("limited_by");
  const hasResponse = types.has("responds_to") || types.has("replaces");

  if (hasExpansion && hasConstraint) {
    return "This record sits inside a documented thread that includes both expansion and later limitation or pushback.";
  }

  if (hasExpansion) {
    return "This record sits inside a documented thread of extension, follow-through, or later reinforcement.";
  }

  if (hasConstraint) {
    return "This record sits inside a documented thread of restriction, rollback, or institutional pushback.";
  }

  if (hasResponse) {
    return "This record is linked to nearby responses and related shifts in the same historical thread.";
  }

  return "Use these linked records to move across the surrounding historical thread rather than reading this page in isolation.";
}

export function buildPolicyRelationshipClusters(relationships = []) {
  const typeCounts = new Map();
  const eraCounts = new Map();

  for (const item of relationships || []) {
    const typeLabel = titleCaseLabel(item?.related_policy_type);
    const eraLabel = String(item?.related_policy_era || "").trim();

    if (typeLabel) {
      typeCounts.set(typeLabel, (typeCounts.get(typeLabel) || 0) + 1);
    }
    if (eraLabel) {
      eraCounts.set(eraLabel, (eraCounts.get(eraLabel) || 0) + 1);
    }
  }

  const topTypes = Array.from(typeCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([label, count]) => ({ label, count, kind: "type" }));
  const topEras = Array.from(eraCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 2)
    .map(([label, count]) => ({ label, count, kind: "era" }));

  return [...topTypes, ...topEras].slice(0, 3);
}

export function buildPolicyRelationshipClusterSummary(relationships = []) {
  const clusters = buildPolicyRelationshipClusters(relationships);
  if (!clusters.length) {
    return null;
  }

  const labels = clusters.map((item) =>
    item.kind === "era" ? `${item.label} context` : `${item.label} thread`
  );

  if (labels.length === 1) {
    return `Visible cluster: ${labels[0]}.`;
  }

  if (labels.length === 2) {
    return `Visible clusters: ${labels[0]} and ${labels[1]}.`;
  }

  return `Visible clusters: ${labels[0]}, ${labels[1]}, and ${labels[2]}.`;
}

export function buildPolicyNextRecordSuggestions(relationships = [], currentYear = null) {
  const resolvedCurrentYear = Number(currentYear);

  return (relationships || [])
    .slice()
    .sort((left, right) => {
      const leftPriority = getRelationshipPriority(left.relationship_type);
      const rightPriority = getRelationshipPriority(right.relationship_type);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftDistance = Number.isFinite(resolvedCurrentYear)
        ? Math.abs(Number(left.related_policy_year || resolvedCurrentYear) - resolvedCurrentYear)
        : Number(left.related_policy_year || 0);
      const rightDistance = Number.isFinite(resolvedCurrentYear)
        ? Math.abs(Number(right.related_policy_year || resolvedCurrentYear) - resolvedCurrentYear)
        : Number(right.related_policy_year || 0);

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return String(left.related_policy_title || "").localeCompare(
        String(right.related_policy_title || "")
      );
    })
    .slice(0, 2);
}
