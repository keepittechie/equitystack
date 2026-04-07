const INTENT_CATEGORY_LABELS = {
  equity_expanding: "Equity Expanding",
  equity_restricting: "Equity Restricting",
  neutral_administrative: "Neutral / Administrative",
  mixed_or_competing: "Mixed or Competing",
  unclear: "Unclear",
};

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeIntentCategory(value) {
  const normalized = normalizeText(value)?.toLowerCase().replaceAll("-", "_");
  if (!normalized) {
    return null;
  }

  if (normalized in INTENT_CATEGORY_LABELS) {
    return normalized;
  }

  return null;
}

function normalizeImpactDirection(value) {
  const normalized = normalizeText(value)?.toLowerCase();
  if (normalized === "positive") return "Positive";
  if (normalized === "negative") return "Negative";
  if (normalized === "mixed") return "Mixed";
  if (normalized === "blocked") return "Blocked";
  return null;
}

export function compareIntentVsOutcome(policy = {}) {
  const intentSummary = normalizeText(policy.policy_intent_summary);
  const intentCategory = normalizeIntentCategory(policy.policy_intent_category);
  const impactDirection = normalizeImpactDirection(policy.impact_direction);
  const notes = [];

  if (!intentSummary && !intentCategory) {
    return {
      classification: "unclassified",
      intent_category: null,
      intent_category_label: null,
      impact_direction: impactDirection,
      rationale: "No explicit policy intent is recorded; classification is not inferred.",
      notes: ["intent_missing"],
    };
  }

  if (!intentCategory) {
    return {
      classification: "mixed",
      intent_category: null,
      intent_category_label: null,
      impact_direction: impactDirection,
      rationale: "Intent summary exists but no structured intent category is recorded.",
      notes: ["intent_category_missing"],
    };
  }

  if (!impactDirection) {
    return {
      classification: "mixed",
      intent_category: intentCategory,
      intent_category_label: INTENT_CATEGORY_LABELS[intentCategory],
      impact_direction: null,
      rationale: "Structured intent exists, but the policy impact direction is missing.",
      notes: ["impact_direction_missing"],
    };
  }

  if (intentCategory === "mixed_or_competing" || intentCategory === "unclear") {
    return {
      classification: "mixed",
      intent_category: intentCategory,
      intent_category_label: INTENT_CATEGORY_LABELS[intentCategory],
      impact_direction: impactDirection,
      rationale: "Intent is mixed, competing, or unclear, so outcome alignment should stay mixed.",
      notes,
    };
  }

  if (intentCategory === "neutral_administrative") {
    return {
      classification: impactDirection === "Mixed" ? "aligned" : "mixed",
      intent_category: intentCategory,
      intent_category_label: INTENT_CATEGORY_LABELS[intentCategory],
      impact_direction: impactDirection,
      rationale:
        impactDirection === "Mixed"
          ? "Neutral/administrative intent and mixed outcome direction are treated as aligned."
          : "Neutral/administrative intent produced a directional outcome, so review is needed.",
      notes,
    };
  }

  if (intentCategory === "equity_expanding") {
    const classification =
      impactDirection === "Positive"
        ? "aligned"
        : impactDirection === "Mixed"
          ? "mixed"
          : "misaligned";
    return {
      classification,
      intent_category: intentCategory,
      intent_category_label: INTENT_CATEGORY_LABELS[intentCategory],
      impact_direction: impactDirection,
      rationale:
        "Equity-expanding intent is aligned with positive outcomes, mixed with mixed outcomes, and misaligned with negative or blocked outcomes.",
      notes,
    };
  }

  if (intentCategory === "equity_restricting") {
    const classification =
      impactDirection === "Negative"
        ? "aligned"
        : impactDirection === "Mixed"
          ? "mixed"
          : "misaligned";
    return {
      classification,
      intent_category: intentCategory,
      intent_category_label: INTENT_CATEGORY_LABELS[intentCategory],
      impact_direction: impactDirection,
      rationale:
        "Equity-restricting intent is analytically aligned with negative outcomes, mixed with mixed outcomes, and misaligned when outcomes are positive or blocked.",
      notes,
    };
  }

  return {
    classification: "mixed",
    intent_category: intentCategory,
    intent_category_label: INTENT_CATEGORY_LABELS[intentCategory] || null,
    impact_direction: impactDirection,
    rationale: "Intent/outcome relationship needs manual review.",
    notes: ["manual_review_required"],
  };
}

export function summarizeIntentVsOutcome(policies = []) {
  const distribution = {
    aligned: 0,
    mixed: 0,
    misaligned: 0,
    unclassified: 0,
  };
  const byAdministration = {};
  const rows = Array.isArray(policies) ? policies : [];

  for (const policy of rows) {
    const comparison = compareIntentVsOutcome(policy);
    distribution[comparison.classification] =
      (distribution[comparison.classification] || 0) + 1;

    const adminKey =
      normalizeText(policy.president_slug) ||
      normalizeText(policy.president_name) ||
      normalizeText(policy.president) ||
      "unknown";
    if (!byAdministration[adminKey]) {
      byAdministration[adminKey] = {
        president_slug: normalizeText(policy.president_slug) || adminKey,
        president_name:
          normalizeText(policy.president_name) || normalizeText(policy.president) || null,
        aligned: 0,
        mixed: 0,
        misaligned: 0,
        unclassified: 0,
      };
    }
    byAdministration[adminKey][comparison.classification] += 1;
  }

  const classifiedCount = distribution.aligned + distribution.mixed + distribution.misaligned;
  return {
    total_policies: rows.length,
    classified_policy_count: classifiedCount,
    unclassified_policy_count: distribution.unclassified,
    distribution,
    percentages: {
      aligned: classifiedCount ? Number((distribution.aligned / classifiedCount).toFixed(4)) : 0,
      mixed: classifiedCount ? Number((distribution.mixed / classifiedCount).toFixed(4)) : 0,
      misaligned: classifiedCount
        ? Number((distribution.misaligned / classifiedCount).toFixed(4))
        : 0,
    },
    patterns_across_administrations: Object.values(byAdministration).sort((left, right) =>
      String(left.president_slug).localeCompare(String(right.president_slug))
    ),
  };
}
