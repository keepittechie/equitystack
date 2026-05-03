function toCount(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function joinEditorialList(items = []) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) {
    return "";
  }
  if (filtered.length === 1) {
    return filtered[0];
  }
  if (filtered.length === 2) {
    return `${filtered[0]} and ${filtered[1]}`;
  }
  return `${filtered.slice(0, -1).join(", ")}, and ${filtered[filtered.length - 1]}`;
}

function formatCollectionCount(value, label) {
  const resolved = toCount(value);
  const normalizedLabel = String(label || "record").trim() || "record";
  return `${resolved} ${normalizedLabel}${resolved === 1 ? "" : "s"}`;
}

function inferToneFromLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized) {
    return "default";
  }
  if (
    normalized.includes("well-supported") ||
    normalized.includes("strong") ||
    normalized.includes("high")
  ) {
    return "verified";
  }
  if (
    normalized.includes("developing") ||
    normalized.includes("moderate") ||
    normalized.includes("medium")
  ) {
    return "info";
  }
  if (normalized.includes("early") || normalized.includes("limited")) {
    return "warning";
  }
  if (normalized.includes("weak") || normalized.includes("low")) {
    return "danger";
  }
  return "default";
}

export function buildEvidenceCoverage({
  sourceCount = 0,
  demographicImpactCount = 0,
  directImpactCount = null,
  fundingImpactCount = 0,
  supportingImpactCount = 0,
  hasScore = false,
  hasPolicyScore = false,
} = {}) {
  const resolvedSourceCount = toCount(sourceCount);
  const resolvedImpactCount = toCount(demographicImpactCount);
  const resolvedDirectCount =
    directImpactCount == null ? toCount(fundingImpactCount) : toCount(directImpactCount);
  const resolvedSupportingCount = toCount(supportingImpactCount);
  const resolvedHasScore = Boolean(hasScore || hasPolicyScore);

  if (
    !resolvedSourceCount &&
    !resolvedImpactCount &&
    !resolvedDirectCount &&
    !resolvedSupportingCount &&
    !resolvedHasScore
  ) {
    return null;
  }

  if (
    resolvedHasScore &&
    resolvedSourceCount >= 4 &&
    resolvedImpactCount >= 4 &&
    resolvedDirectCount >= 1 &&
    resolvedSupportingCount >= 1
  ) {
    return {
      label: "Well-supported analysis",
      tone: "verified",
      description:
        "This reflects how much sourced demographic-impact analysis has been added so far. This record includes both direct-impact and supporting-evidence layers with a broader visible source base.",
    };
  }

  if (
    resolvedSourceCount >= 2 &&
    (resolvedImpactCount >= 2 || resolvedHasScore) &&
    (resolvedDirectCount >= 1 || resolvedSupportingCount >= 1)
  ) {
    return {
      label: "Developing evidence base",
      tone: "info",
      description:
        "This reflects how much sourced demographic-impact analysis has been added so far. The current read includes structured analysis, but the evidence layer is still growing.",
    };
  }

  return {
    label: "Early analysis",
    tone: "default",
    description:
      "This reflects how much sourced demographic-impact analysis has been added so far. The current read should be treated as provisional while more structured evidence is added.",
  };
}

export function buildEvidenceStrengtheningNote(inputs = {}) {
  const coverage = buildEvidenceCoverage(inputs);
  if (!coverage || coverage.label === "Well-supported analysis") {
    return null;
  }

  const resolvedSourceCount = toCount(inputs.sourceCount);
  const resolvedImpactCount = toCount(inputs.demographicImpactCount);
  const resolvedDirectCount =
    inputs.directImpactCount == null
      ? toCount(inputs.fundingImpactCount)
      : toCount(inputs.directImpactCount);
  const resolvedSupportingCount = toCount(inputs.supportingImpactCount);
  const resolvedHasScore = Boolean(inputs.hasScore || inputs.hasPolicyScore);
  const suggestions = [];

  if (resolvedSourceCount < 4) {
    suggestions.push("additional linked sources");
  }

  if (!resolvedHasScore) {
    suggestions.push("fuller score coverage across the existing structured record");
  }

  if (resolvedDirectCount > 0 && resolvedSupportingCount === 0) {
    suggestions.push("more program-level participation or beneficiary data");
  } else if (resolvedDirectCount === 0 && resolvedSupportingCount > 0) {
    suggestions.push("clearer direct impact rows tied to the source record");
  } else if (resolvedImpactCount < 4) {
    suggestions.push("more supporting demographic evidence at the program or community level");
  }

  if (!suggestions.length) {
    suggestions.push("additional sourced demographic-impact analysis");
  }

  return {
    title: "What would strengthen this analysis?",
    description: `This analysis would be strengthened by ${joinEditorialList(
      suggestions.slice(0, 3)
    )}.`,
  };
}

export function buildEvidenceSignal({
  confidenceLabel = null,
  evidenceStrength = null,
  sourceCount = 0,
  labelOverride = null,
  ...coverageInputs
} = {}) {
  const normalizedLabelOverride = String(labelOverride || "").trim();
  if (normalizedLabelOverride) {
    return {
      label: normalizedLabelOverride,
      tone: inferToneFromLabel(normalizedLabelOverride),
      title: normalizedLabelOverride,
    };
  }

  const normalizedEvidenceStrength = String(evidenceStrength || "").trim();
  if (normalizedEvidenceStrength) {
    const label = normalizedEvidenceStrength.toLowerCase().includes("evidence")
      ? normalizedEvidenceStrength
      : `${normalizedEvidenceStrength} evidence`;
    return {
      label,
      tone: inferToneFromLabel(label),
      title: label,
    };
  }

  const normalizedConfidenceLabel = String(confidenceLabel || "").trim();
  if (normalizedConfidenceLabel) {
    const label = normalizedConfidenceLabel.toLowerCase().includes("confidence")
      ? normalizedConfidenceLabel
      : `${normalizedConfidenceLabel} confidence`;
    return {
      label,
      tone: inferToneFromLabel(label),
      title: label,
    };
  }

  const coverage = buildEvidenceCoverage({
    sourceCount,
    ...coverageInputs,
  });

  if (coverage) {
    return {
      label:
        coverage.label === "Developing evidence base"
          ? "Developing evidence"
          : coverage.label,
      tone: coverage.tone,
      title: coverage.label,
    };
  }

  const resolvedSourceCount = toCount(sourceCount);
  if (!resolvedSourceCount) {
    return null;
  }

  let label = "Limited evidence";
  if (resolvedSourceCount >= 6) {
    label = "Strong evidence";
  } else if (resolvedSourceCount >= 3) {
    label = "Moderate evidence";
  }

  return {
    label,
    tone: inferToneFromLabel(label),
    title: label,
  };
}

export function buildResearchCoverage({
  sourceCount = 0,
  outcomeCount = 0,
  relatedRecordCount = 0,
  hasScore = false,
  confidenceLabel = null,
} = {}) {
  const resolvedSourceCount = toCount(sourceCount);
  const resolvedOutcomeCount = toCount(outcomeCount);
  const resolvedRelatedCount = toCount(relatedRecordCount);
  const resolvedHasScore = Boolean(hasScore);
  const normalizedConfidence = String(confidenceLabel || "").toLowerCase();

  if (
    !resolvedSourceCount &&
    !resolvedOutcomeCount &&
    !resolvedRelatedCount &&
    !resolvedHasScore &&
    !normalizedConfidence
  ) {
    return null;
  }

  if (
    resolvedHasScore &&
    resolvedSourceCount >= 6 &&
    resolvedOutcomeCount >= 4 &&
    resolvedRelatedCount >= 2
  ) {
    return {
      label: "Well-supported analysis",
      tone: "verified",
      description:
        "This record has a stronger visible research base in the current public dataset, with scored interpretation backed by multiple linked records, outcomes, and sources.",
    };
  }

  if (
    (resolvedHasScore || normalizedConfidence) &&
    resolvedSourceCount >= 2 &&
    (resolvedOutcomeCount >= 2 || resolvedRelatedCount >= 2)
  ) {
    return {
      label: "Developing evidence base",
      tone: "info",
      description:
        "This record already has a usable public evidence layer, but the visible source trail or linked outcome base is still growing.",
    };
  }

  return {
    label: "Early analysis",
    tone: "default",
    description:
      "This record is present in the public research layer, but the visible score support, outcome coverage, or source trail is still relatively thin.",
  };
}

export function buildResearchStrengtheningNote(inputs = {}) {
  const coverage = buildResearchCoverage(inputs);
  if (!coverage || coverage.label === "Well-supported analysis") {
    return null;
  }

  const resolvedSourceCount = toCount(inputs.sourceCount);
  const resolvedOutcomeCount = toCount(inputs.outcomeCount);
  const resolvedRelatedCount = toCount(inputs.relatedRecordCount);
  const resolvedHasScore = Boolean(inputs.hasScore);
  const suggestions = [];

  if (resolvedSourceCount < 6) {
    suggestions.push("additional linked sources");
  }

  if (resolvedOutcomeCount < 4) {
    suggestions.push("more outcome-backed records");
  }

  if (resolvedRelatedCount < 2) {
    suggestions.push("more connected policies, promises, or explanatory context");
  }

  if (!resolvedHasScore) {
    suggestions.push("a fuller scored record");
  }

  if (!suggestions.length) {
    suggestions.push("more public evidence and linked record depth");
  }

  return {
    title: "What would strengthen this record?",
    description: `This record would be strengthened by ${joinEditorialList(
      suggestions.slice(0, 3)
    )}.`,
  };
}

export function buildCollectionResearchCoverage({
  totalCount = 0,
  sourcedCount = 0,
  structuredCount = 0,
  relatedCount = 0,
  scoredCount = 0,
  collectionLabel = "visible record",
  structuredLabel = "structured analysis",
  relatedLabel = "linked context",
} = {}) {
  const resolvedTotal = toCount(totalCount);
  const resolvedSourced = toCount(sourcedCount);
  const resolvedStructured = toCount(structuredCount);
  const resolvedRelated = toCount(relatedCount);
  const resolvedScored = toCount(scoredCount);

  if (!resolvedTotal) {
    return null;
  }

  const sourcedShare = resolvedSourced / resolvedTotal;
  const structuredShare = resolvedStructured / resolvedTotal;
  const relatedShare = resolvedRelated / resolvedTotal;
  const scoredShare = resolvedScored / resolvedTotal;

  let label = "Early analysis";
  let tone = "default";

  if (
    sourcedShare >= 0.7 &&
    (structuredShare >= 0.5 || scoredShare >= 0.5) &&
    relatedShare >= 0.25
  ) {
    label = "Well-supported analysis";
    tone = "verified";
  } else if (
    sourcedShare >= 0.4 &&
    (structuredShare >= 0.25 || scoredShare >= 0.25 || relatedShare >= 0.25)
  ) {
    label = "Developing evidence base";
    tone = "info";
  }

  const parts = [
    formatCollectionCount(resolvedSourced, `${collectionLabel} with visible source`),
    resolvedStructured
      ? formatCollectionCount(resolvedStructured, `${collectionLabel} with ${structuredLabel}`)
      : null,
    resolvedScored
      ? formatCollectionCount(resolvedScored, `${collectionLabel} with score context`)
      : null,
    resolvedRelated
      ? formatCollectionCount(resolvedRelated, `${collectionLabel} with ${relatedLabel}`)
      : null,
  ].filter(Boolean);

  return {
    label,
    tone,
    description: `In this view, ${joinEditorialList(parts.slice(0, 4))}.`,
  };
}

export function buildCollectionResearchStrengtheningNote({
  totalCount = 0,
  sourcedCount = 0,
  structuredCount = 0,
  relatedCount = 0,
  scoredCount = 0,
  collectionLabel = "records",
  structuredLabel = "structured analysis",
  relatedLabel = "linked context",
} = {}) {
  const coverage = buildCollectionResearchCoverage({
    totalCount,
    sourcedCount,
    structuredCount,
    relatedCount,
    scoredCount,
    collectionLabel,
    structuredLabel,
    relatedLabel,
  });

  if (!coverage || coverage.label === "Well-supported analysis") {
    return null;
  }

  const resolvedTotal = toCount(totalCount);
  const resolvedSourced = toCount(sourcedCount);
  const resolvedStructured = toCount(structuredCount);
  const resolvedRelated = toCount(relatedCount);
  const resolvedScored = toCount(scoredCount);
  const suggestions = [];

  if (resolvedSourced < resolvedTotal) {
    suggestions.push("more linked source coverage across the visible records");
  }

  if (resolvedStructured < resolvedTotal && structuredLabel) {
    suggestions.push(`broader ${structuredLabel}`);
  }

  if (resolvedScored < resolvedTotal && resolvedScored > 0) {
    suggestions.push("score context on more records in this slice");
  }

  if (resolvedRelated < resolvedTotal && relatedLabel) {
    suggestions.push(`more ${relatedLabel}`);
  }

  if (!suggestions.length) {
    suggestions.push("deeper public research coverage across the visible records");
  }

  return {
    title: "What's still thin in this view?",
    description: `Coverage would be strengthened by ${joinEditorialList(
      suggestions.slice(0, 3)
    )}.`,
  };
}
