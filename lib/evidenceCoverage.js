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
