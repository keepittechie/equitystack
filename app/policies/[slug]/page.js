import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchInternalJson } from "@/lib/api";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchPolicyDetailBySlug } from "@/lib/public-site-data";
import { computePolicyImpactScore } from "@/lib/analytics/impactAggregator";
import {
  buildEvidenceCoverage,
  buildEvidenceSignal,
  buildEvidenceStrengtheningNote,
  buildResearchCoverage,
  buildResearchStrengtheningNote,
} from "@/lib/evidenceCoverage";
import {
  countLabel,
  filterParagraphs,
  isThinText,
  oxfordJoin,
  sentenceJoin,
  takeLabels,
} from "@/lib/editorial-depth";
import { getFlagshipPolicyEditorial } from "@/lib/flagship-editorial";
import {
  formatSystemicImpactLabel,
  isNonStandardSystemicImpact,
  shouldRenderSystemicImpact,
  systemicMultiplierFor,
} from "@/lib/systemicImpact";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import EquityStackTabbar from "@/app/components/dashboard/EquityStackTabbar";
import {
  MethodologyCallout,
  SourceTrustPanel,
  CitationNote,
} from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import ResearchCoveragePanel from "@/app/components/public/ResearchCoveragePanel";
import PolicyLineagePanel from "@/app/components/public/PolicyLineagePanel";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import DiscoveryGuidancePanel from "@/app/components/public/DiscoveryGuidancePanel";
import WhyThisScorePanel from "@/app/components/public/WhyThisScorePanel";
import {
  EvidenceSourceList,
  PolicyTimeline,
  PromiseResultsTable,
} from "@/app/components/public/entities";
import {
  getCompletenessTone,
  getEvidenceTone,
  getImpactDirectionTone,
  MetricCard,
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import {
  buildBreadcrumbJsonLd,
  buildPolicyJsonLd,
} from "@/lib/structured-data";
import { explainPolicyScore } from "@/lib/black-impact-score/scoreExplanations";
import ShareCardPanel from "@/app/components/share/ShareCardPanel";
import { buildPolicyCardHref } from "@/lib/shareable-card-links";
import {
  buildPolicyRelationshipClusterSummary,
  buildPolicyNextRecordSuggestions,
  formatPolicyRelationshipTypeLabel,
  getPolicyRelationshipTone,
  summarizePolicyRelationshipContinuity,
} from "@/lib/policyRelationships";

export const dynamic = "force-dynamic";
const POLICY_IMPACT_SCORE_MAX = 35;

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return numeric.toFixed(2);
}

function formatSystemicMultiplier(value) {
  return `${Number(value || 1).toFixed(2)}x`;
}

function formatCompactScoreValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function formatCurrencyValue(value, unit = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  if (unit === "USD") {
    const hasFraction = Math.abs(numeric % 1) > 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    }).format(numeric);
  }

  return new Intl.NumberFormat("en-US").format(numeric);
}

function isFundingImpact(impact) {
  const metricName = typeof impact === "string" ? impact : impact?.metric_name;
  return /^Proposed FY\d{4} funding level\s*-/i.test(String(metricName || "").trim());
}

function formatImpactScalar(value, unit = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  if (unit === "USD") {
    return formatCurrencyValue(numeric, unit);
  }

  if (unit === "percent") {
    const hasFraction = Math.abs(numeric % 1) > 0;
    return `${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: hasFraction ? 1 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    }).format(numeric)}%`;
  }

  const formatted = new Intl.NumberFormat("en-US").format(numeric);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatFundingChange(impact) {
  const before = formatCurrencyValue(impact?.before_value, impact?.unit);
  const after = formatCurrencyValue(impact?.after_value, impact?.unit);

  if (before === "—" && after === "—") {
    return "Not yet specified";
  }

  if (before === "—") {
    return `To ${after}`;
  }

  if (after === "—") {
    return `From ${before}`;
  }

  return `${before} to ${after}`;
}

function formatImpactValue(impact) {
  if (isFundingImpact(impact)) {
    return formatFundingChange(impact);
  }

  const after = formatImpactScalar(impact?.after_value, impact?.unit);
  const before = formatImpactScalar(impact?.before_value, impact?.unit);
  const comparison = formatImpactScalar(impact?.comparison_value, impact?.unit);

  if (after !== "—" && comparison !== "—") {
    return `${after} (comparison: ${comparison})`;
  }

  if (after !== "—") {
    return after;
  }

  if (before !== "—") {
    return before;
  }

  return "Not yet specified";
}

function formatConfidenceLabel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "Not rated";
  }

  const label = numeric >= 0.75 ? "High" : numeric >= 0.45 ? "Moderate" : "Low";
  return `${label} (${numeric.toFixed(2)})`;
}

function deriveProgramLabel(metricName) {
  const normalized = String(metricName || "").trim();
  if (!normalized) {
    return "Program";
  }

  const proposedFundingMatch = normalized.match(
    /^Proposed FY\d{4} funding level\s*-\s*(.+)$/i
  );
  if (proposedFundingMatch?.[1]) {
    return proposedFundingMatch[1].trim();
  }

  const tailLabel = normalized.split(" - ").pop()?.trim();
  return tailLabel || normalized;
}

function deriveMetricLabel(metricName) {
  const normalized = String(metricName || "").trim();
  if (!normalized || isFundingImpact(normalized)) {
    return null;
  }

  const supportingMatch = normalized.match(/^Supporting evidence\s*-\s*(.+?)\s*-\s*[^-]+$/i);
  if (supportingMatch?.[1]) {
    return supportingMatch[1].trim();
  }

  return normalized;
}

function formatSourceDateLabel(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function buildDemographicImpactSections(impacts = []) {
  const proposedFundingImpacts = impacts.filter((impact) => isFundingImpact(impact));
  const supportingImpacts = impacts.filter((impact) => !isFundingImpact(impact));
  const sections = [];

  if (proposedFundingImpacts.length) {
    sections.push({
      key: "funding",
      title: "Proposed funding changes",
      description:
        supportingImpacts.length
          ? "These rows capture the direct budget changes described in the policy record."
          : null,
      items: proposedFundingImpacts,
    });
  }

  if (supportingImpacts.length) {
    sections.push({
      key: "supporting",
      title: "Supporting evidence",
      description:
        proposedFundingImpacts.length
          ? "These rows show participation, beneficiary, or exposure context that helps explain why the proposed cuts may matter."
          : null,
      items: supportingImpacts,
    });
  }

  return sections;
}

function DemographicImpactCard({ impact }) {
  return (
    <Panel padding="md" className="space-y-5">
      <div className="space-y-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Program
        </p>
        <h3 className="text-lg font-semibold text-white">
          {deriveProgramLabel(impact.metric_name)}
        </h3>
        {deriveMetricLabel(impact.metric_name) ? (
          <p className="text-sm leading-6 text-[var(--ink-soft)]">
            {deriveMetricLabel(impact.metric_name)}
          </p>
        ) : null}
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {isFundingImpact(impact) ? "Proposed funding change" : "Supporting metric"}
          </dt>
          <dd className="mt-2 text-sm leading-7 text-white">
            {formatImpactValue(impact)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Affected group
          </dt>
          <dd className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
            {impact.demographic_group || "Not specified"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Confidence
          </dt>
          <dd className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
            {formatConfidenceLabel(impact.confidence_score)}
          </dd>
        </div>
        {impact.methodology_note ? (
          <div className="sm:col-span-2">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              Notes
            </dt>
            <dd className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {impact.methodology_note}
            </dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Sources
          </dt>
          {(impact.sources || []).length ? (
            <dd className="mt-3 space-y-3">
              {(impact.sources || []).map((source, index) => (
                <div
                  key={`${source.id || source.source_url || source.source_title}-${index}`}
                  className="space-y-1"
                >
                  <a
                    href={source.source_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium leading-6 text-white underline decoration-white/20 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
                  >
                    {source.source_title || source.source_url || "Source"}
                  </a>
                  <p className="text-sm leading-6 text-[var(--ink-soft)]">
                    {[
                      source.source_role === "primary" ? "Primary source" : null,
                      source.publisher || null,
                      formatSourceDateLabel(source.published_date),
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                  {source.citation_note ? (
                    <p className="text-sm leading-6 text-[var(--ink-soft)]">
                      {source.citation_note}
                    </p>
                  ) : null}
                </div>
              ))}
            </dd>
          ) : (
            <dd className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              No linked sources are attached to this impact row yet.
            </dd>
          )}
        </div>
      </dl>
    </Panel>
  );
}

function buildSystemicImpactCard(policy) {
  if (!shouldRenderSystemicImpact(policy?.systemic_impact_category, policy?.systemic_impact_summary)) {
    return null;
  }

  const category = policy?.systemic_impact_category || "standard";
  const label = formatSystemicImpactLabel(category);
  const multiplier = systemicMultiplierFor(category);

  return {
    label,
    multiplier,
    summary:
      policy?.systemic_impact_summary ||
      "This record carries a documented systemic weighting because its effects extended beyond the immediate outcome into durable institutions, doctrine, or enforcement capacity.",
  };
}

function hasCompletePolicyScore(scoreRow = null) {
  if (!scoreRow || typeof scoreRow !== "object") {
    return false;
  }

  return [
    "directness_score",
    "material_impact_score",
    "evidence_score",
    "durability_score",
    "equity_score",
    "harm_offset_score",
  ].every((key) => Number.isFinite(Number(scoreRow[key])));
}

function computePolicyScore(policy) {
  if (!hasCompletePolicyScore(policy?.scores)) {
    return null;
  }

  return computePolicyImpactScore(policy.scores);
}

function normalizePolicyScoreToFive(rawScore) {
  const numeric = Number(rawScore);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Number(
    (Math.max(0, Math.min(numeric, POLICY_IMPACT_SCORE_MAX)) / POLICY_IMPACT_SCORE_MAX * 5).toFixed(1)
  );
}

function formatPolicyScoreOutOfFive(rawScore) {
  const normalized = normalizePolicyScoreToFive(rawScore);
  return normalized == null ? "—" : `${normalized.toFixed(1)} / 5`;
}

function buildBlackImpactScoreSummary(policy, rawScore) {
  if (!Number.isFinite(Number(rawScore))) {
    return null;
  }

  const direction = policy?.impact_direction || "Unknown";
  const scores = policy?.scores || {};
  const explanation = sentenceJoin([
    "This is the record-level policy score used on EquityStack policy pages.",
    "It weights directness, material impact, evidence, durability, equity relevance, and harm offset from the structured policy scoring fields.",
    direction !== "Unknown"
      ? `Because this record is classified as ${String(direction).toLowerCase()} impact, the score should be read as the documented weight of that ${String(direction).toLowerCase()} effect on Black Americans rather than as a generic grade.`
      : null,
  ]);

  const factorLine = [
    `Directness ${Number(scores.directness_score || 0)}`,
    `Material impact ${Number(scores.material_impact_score || 0)}`,
    `Evidence ${Number(scores.evidence_score || 0)}`,
    `Durability ${Number(scores.durability_score || 0)}`,
    `Equity ${Number(scores.equity_score || 0)}`,
    `Harm offset ${Number(scores.harm_offset_score || 0)}`,
  ].join(" • ");

  return {
    display_score: formatPolicyScoreOutOfFive(rawScore),
    raw_score: Number(rawScore),
    direction,
    explanation,
    factor_line: factorLine,
    evidence_label: policy?.evidence_summary?.evidence_strength || null,
  };
}

function buildDemographicContextBridge(policy) {
  const explainers = Array.isArray(policy?.related_explainers)
    ? policy.related_explainers.filter((item) => item?.slug && item?.title)
    : [];
  const sourceCount = Number(policy?.evidence_summary?.total_sources || 0);

  if (!explainers.length && sourceCount <= 1) {
    return null;
  }

  return {
    explainer: explainers[0] || null,
    additionalExplainerCount: Math.max(0, explainers.length - 1),
    sourceCount,
  };
}

function humanizePolicyFactorLabel(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildWhyThisPolicyScore(policy, rawScore, evidenceCoverage, evidenceStrengtheningNote) {
  if (!Number.isFinite(Number(rawScore))) {
    return null;
  }

  const explanation = explainPolicyScore({
    ...policy,
    ...(policy.scores || {}),
    policy_impact_score: rawScore,
    impact_score: rawScore,
  });
  const topContributors = Object.entries(explanation.modifiers || {})
    .filter(([, value]) => Number.isFinite(Number(value?.contribution)))
    .sort(
      (left, right) =>
        Math.abs(Number(right[1].contribution)) - Math.abs(Number(left[1].contribution))
    )
    .slice(0, 3)
    .map(([label, value]) => {
      const contribution = formatCompactScoreValue(value.contribution);
      return `${humanizePolicyFactorLabel(label)} ${contribution}`;
    });
  const evidenceSignal = buildEvidenceSignal({
    sourceCount: Number(policy.sources?.length || policy.evidence_summary?.total_sources || 0),
    evidenceStrength: policy.evidence_summary?.evidence_strength || null,
    hasPolicyScore: true,
  });

  return {
    summary:
      explanation.notes?.[0] ||
      "This is a bounded record-level score built from the structured policy fields already attached to the page.",
    items: [
      topContributors.length
        ? {
            label: "Strongest contributors",
            value: topContributors.join(" • "),
            detail:
              "Directness, material impact, evidence, durability, equity relevance, and harm offset do the main weighting work.",
          }
        : null,
      {
        label: "Effect trend",
        value: policy.impact_direction ? `${policy.impact_direction} effect` : "Direction still limited",
        detail:
          "The score should be read as the documented direction and weight of this record's effect on Black Americans, not as a generic grade.",
      },
      evidenceSignal
        ? {
            label: "Evidence read",
            value: evidenceSignal.label,
            detail: evidenceCoverage?.description || null,
          }
        : null,
      evidenceStrengtheningNote
        ? {
            label: "What is still thin",
            value: "Some analysis remains provisional",
            detail: evidenceStrengtheningNote.description,
          }
        : null,
    ].filter(Boolean),
  };
}

function buildComparisonLinkDescription(baseLabel, item = {}) {
  return [
    baseLabel,
    item.year_enacted || item.related_policy_year || null,
    item.impact_direction || item.related_policy_impact_direction
      ? `${item.impact_direction || item.related_policy_impact_direction} impact`
      : null,
    Number.isFinite(Number(item.impact_score))
      ? `Impact score ${formatScore(item.impact_score)}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

async function fetchComparisonFallbackPolicies(searchParams = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value != null && value !== "") {
      params.set(key, String(value));
    }
  }
  params.set("sort", "impact_score_desc");
  params.set("page_size", "8");

  const result = await fetchInternalJson(`/api/policies?${params.toString()}`, {
    errorMessage: "Failed to fetch policy comparison suggestions",
  });

  return Array.isArray(result?.items) ? result.items : [];
}

async function buildPolicyComparisonEntries(policy) {
  const currentPolicyId = Number(policy?.id);
  if (!Number.isFinite(currentPolicyId) || currentPolicyId <= 0) {
    return [];
  }

  const limit = 4;
  const seen = new Set([currentPolicyId]);
  const entries = [];

  const pushEntry = (entry) => {
    const candidateId = Number(entry?.id);
    if (!Number.isFinite(candidateId) || seen.has(candidateId) || entries.length >= limit) {
      return;
    }

    seen.add(candidateId);
    entries.push({
      ...entry,
      compare_href: `/compare/policies?compare=${currentPolicyId},${candidateId}`,
    });
  };

  for (const item of policy.relationships || []) {
    pushEntry({
      id: item.related_policy_id,
      title: item.related_policy_title,
      eyebrow: "Explicit relationship",
        description: buildComparisonLinkDescription(
          formatPolicyRelationshipTypeLabel(item.relationship_type),
          item
        ),
      });
  }

  if (entries.length < limit && policy.categories?.[0]?.name) {
    const categoryPolicies = await fetchComparisonFallbackPolicies({
      category: policy.categories[0].name,
    });
    for (const item of categoryPolicies) {
      pushEntry({
        id: item.id,
        title: item.title,
        eyebrow: "Same category",
        description: buildComparisonLinkDescription(
          policy.categories[0].name,
          item
        ),
      });
    }
  }

  if (entries.length < limit && policy.president) {
    const presidentPolicies = await fetchComparisonFallbackPolicies({
      president: policy.president,
    });
    for (const item of presidentPolicies) {
      pushEntry({
        id: item.id,
        title: item.title,
        eyebrow: "Same administration",
        description: buildComparisonLinkDescription("Same president", item),
      });
    }
  }

  if (entries.length < limit && policy.era) {
    const eraPolicies = await fetchComparisonFallbackPolicies({
      era: policy.era,
    });
    for (const item of eraPolicies) {
      pushEntry({
        id: item.id,
        title: item.title,
        eyebrow: "Same era",
        description: buildComparisonLinkDescription(policy.era, item),
      });
    }
  }

  return entries.slice(0, limit);
}

function buildTimeline(policy) {
  const events = [];

  if (policy.year_enacted) {
    events.push({
      year: policy.year_enacted,
      summary: policy.summary || "Policy enters the public historical record.",
    });
  }

  if (policy.outcome_summary) {
    events.push({
      label: "Outcome",
      summary: policy.outcome_summary,
    });
  }

  if (policy.source_mix_summary?.newest_source_date) {
    events.push({
      date: policy.source_mix_summary.newest_source_date,
      summary: "Latest source linked to this policy record.",
    });
  }

  if (policy.era_navigation?.previous?.title) {
    events.push({
      label: "Era context",
      summary: `Previous era-adjacent record: ${policy.era_navigation.previous.title}.`,
    });
  }

  return events;
}

function buildWhatItMeans(policy) {
  if (policy.outcome_summary) {
    return policy.outcome_summary;
  }

  if (policy.summary) {
    return policy.summary;
  }

  return "This record is in the dataset, but the Black-community impact narrative has not been fully written yet.";
}

function buildWhyItMatters(policy) {
  const direction = policy.impact_direction || "Unknown";
  const evidence = policy.evidence_summary?.evidence_strength || "Limited";
  return `EquityStack classifies this policy as ${direction.toLowerCase()} impact with ${evidence.toLowerCase()} supporting evidence. The record matters because it helps explain how government action shaped Black Americans' rights, resources, exposure to harm, or access to institutions.`;
}

function buildPolicyRecordOverview(policy, editorial = null) {
  const categoryLabels = takeLabels(policy.categories, (item) => item.name, 3);

  return sentenceJoin([
    policy.president
      ? `${policy.title} is tracked here inside the ${policy.president} record.`
      : `${policy.title} is tracked here as part of the public historical policy record.`,
    policy.year_enacted
      ? `The page anchors the record in ${policy.year_enacted}${policy.policy_type ? ` as a ${policy.policy_type.toLowerCase()}` : ""}.`
      : policy.policy_type
        ? `The page treats it as a ${policy.policy_type.toLowerCase()} record.`
        : null,
    categoryLabels.length
      ? `Its clearest topical connections in the current dataset are ${oxfordJoin(categoryLabels)}.`
      : null,
    editorial?.overviewSuffix || null,
  ]);
}

function buildPolicyCoverageNote(policy) {
  const sourceCount = Number(policy.evidence_summary?.total_sources || 0);
  const evidenceStrength = policy.evidence_summary?.evidence_strength || "limited";

  return sentenceJoin([
    `This page is designed to stay useful even when the narrative summary is short.`,
    `Use the score, source trail, and related records together rather than relying on one paragraph alone.`,
    `${countLabel(sourceCount, "source")} currently support this record, with ${String(
      evidenceStrength
    ).toLowerCase()} evidence strength in the public view.`,
  ]);
}

function buildPolicyReferenceSynthesis({
  policy,
  score,
  blackImpactScoreSummary,
  coverage,
  strengtheningNote,
  relationships = [],
  editorial = null,
}) {
  const continuity = relationships.length
    ? sentenceJoin([
        summarizePolicyRelationshipContinuity(relationships),
        buildPolicyRelationshipClusterSummary(relationships),
      ])
    : null;

  return {
    summary: sentenceJoin([
      policy.summary || buildPolicyRecordOverview(policy, editorial),
      buildWhyItMatters(policy),
    ]),
    items: [
      {
        label: "What happened",
        value: policy.summary ? "Published summary available" : "Summary still relatively thin",
        detail: policy.summary || buildPolicyRecordOverview(policy, editorial),
      },
      {
        label: "Why it matters",
        value: policy.impact_direction
          ? `${policy.impact_direction} impact`
          : "Impact direction still limited",
        detail: buildWhyItMatters(policy),
      },
      {
        label: "Impact signal",
        value: `Score ${formatScore(score)}`,
        detail:
          blackImpactScoreSummary?.explanation ||
          buildWhatItMeans(policy),
      },
      coverage
        ? {
            label: "Evidence read",
            value: coverage.label,
            detail: coverage.description,
          }
        : null,
      continuity
        ? {
            label: "Historical thread",
            value: "Part of a larger chain",
            detail: continuity,
          }
        : null,
    ].filter(Boolean),
    note: strengtheningNote?.description || null,
  };
}

function buildPolicyReferenceUtility({
  policy,
  score,
  blackImpactScoreSummary,
  coverage,
}) {
  const sourceCount = Number(policy.sources?.length || policy.evidence_summary?.total_sources || 0);
  const referenceLine = [
    policy.title,
    policy.year_enacted ? `(${policy.year_enacted})` : null,
    policy.policy_type ? `${policy.policy_type} record` : null,
    policy.president ? `${policy.president} context` : null,
    policy.impact_direction ? `${policy.impact_direction} impact` : null,
    blackImpactScoreSummary?.display_score
      ? `Black Impact Score ${blackImpactScoreSummary.display_score}`
      : Number.isFinite(Number(score))
        ? `Impact score ${formatScore(score)}`
        : null,
    coverage?.label || null,
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    description:
      "When citing this record, name the policy, EquityStack, the page URL, and your access date. For a stronger public reference, also note the administration or year context, the current impact direction, and whether the visible evidence base is still developing or already well-supported.",
    referenceLine,
    items: [
      {
        label: "Name the record",
        value: sentenceJoin([
          policy.title,
          policy.year_enacted ? `Year ${policy.year_enacted}` : null,
          policy.policy_type ? `${policy.policy_type} record` : null,
        ]),
        detail:
          "This keeps the reference anchored to the specific law, order, case, or program record rather than to a broader administration or topic page.",
      },
      {
        label: "Anchor the context",
        value:
          sentenceJoin([
            policy.president ? `${policy.president} context` : null,
            policy.era || null,
            takeLabels(policy.categories, (item) => item.name, 2).join(" • ") || null,
          ]) || "Historical policy record",
        detail:
          "Use administration, era, or category context when you need to place the record inside a broader Black policy history thread.",
      },
      {
        label: "Characterize the impact",
        value:
          sentenceJoin([
            policy.impact_direction ? `${policy.impact_direction} impact` : null,
            blackImpactScoreSummary?.display_score
              ? `Black Impact Score ${blackImpactScoreSummary.display_score}`
              : Number.isFinite(Number(score))
                ? `Impact score ${formatScore(score)}`
                : null,
          ]) || "Impact interpretation still limited",
        detail:
          "Treat the score and direction as record-level interpretation, not as a complete judgment of the entire historical period.",
      },
      {
        label: "Pair with evidence",
        value:
          sentenceJoin([
            countLabel(sourceCount, "source"),
            coverage?.label || null,
          ]) || "Visible evidence base still thin",
        detail:
          "Pair the page citation with the source trail or methodology when precision matters, especially if the current coverage is still developing.",
      },
    ],
  };
}

function buildPolicyNextReviewGuidance({
  policy,
  relationships = [],
  currentYear = null,
  editorial = null,
}) {
  const items = [];
  const seen = new Set();
  const explainer = Array.isArray(policy.related_explainers)
    ? policy.related_explainers.find((item) => item?.slug && item?.title)
    : null;
  if (explainer) {
    const href = `/explainers/${explainer.slug}`;
    if (!seen.has(href)) {
      seen.add(href);
      items.push({
        label: explainer.category || "Context explainer",
        tone: "info",
        title: explainer.title,
        description:
          explainer.summary ||
          "Use the explainer when you need broader historical or doctrinal context around this record.",
        href,
      });
    }
  }

  const reportHref = "/reports/black-impact-score";
  if (items.length < 4 && !seen.has(reportHref)) {
    seen.add(reportHref);
    items.push({
      label: "Flagship report",
      tone: "info",
      title: "Black Impact Score",
      description:
        "Move from this policy record into the flagship report when you want higher-level presidential or historical comparison context.",
      href: reportHref,
    });
  }

  const broaderContext = buildResearchPaths(policy, editorial)[0];
  if (broaderContext && items.length < 4 && !seen.has(broaderContext.href)) {
    seen.add(broaderContext.href);
    items.push({
      label: broaderContext.label || "Broader context",
      tone: "default",
      title: broaderContext.title,
      description: broaderContext.description,
      href: broaderContext.href,
    });
  }

  const lineageSuggestion = buildPolicyNextRecordSuggestions(relationships, currentYear)[0];
  if (lineageSuggestion && items.length < 4) {
    const href = `/policies/${buildPolicySlug({
      id: lineageSuggestion.related_policy_id,
      title: lineageSuggestion.related_policy_title,
    })}`;
    if (!seen.has(href)) {
      seen.add(href);
      items.push({
        label: "Policy thread",
        tone: getPolicyRelationshipTone(lineageSuggestion.relationship_type),
        title: lineageSuggestion.related_policy_title,
        meta: [
          formatPolicyRelationshipTypeLabel(lineageSuggestion.relationship_type),
          lineageSuggestion.related_policy_year,
        ]
          .filter(Boolean)
          .join(" • "),
        description:
          lineageSuggestion.notes ||
          "Open the closest linked policy record when you want adjacent context inside the same historical thread.",
        href,
      });
    }
  }

  const promise = Array.isArray(policy.related_promises)
    ? policy.related_promises.find((item) => item?.slug && item?.title)
    : null;
  if (promise && items.length < 4) {
    const href = `/promises/${promise.slug}`;
    if (!seen.has(href)) {
      seen.add(href);
      items.push({
        label: "Connected promise",
        tone: "default",
        title: promise.title,
        meta: promise.status || null,
        description:
          promise.summary ||
          "Use the connected promise record when you want to see the commitment, follow-through, and downstream policy context together.",
        href,
      });
    }
  }

  return items.slice(0, 4);
}

function buildPolicyGuideCards(policy, editorial = null) {
  const thinNarrative =
    isThinText(policy.summary, 140) || isThinText(policy.outcome_summary, 140);

  return [
    {
      eyebrow: "What this record covers",
      title: "A single policy, law, order, or court-era record",
      description:
        buildPolicyRecordOverview(policy, editorial) ||
        "This page organizes one policy record with score, evidence, and related context.",
    },
    {
      eyebrow: "How to use it",
      title: "Read the record before drawing broader conclusions",
      description:
        "Start with the summary and outcome language, then compare the source trail, linked promises, and related policies before moving into reports or thematic pages.",
    },
    {
      eyebrow: "Coverage note",
      title: thinNarrative ? "This record needs context around a short narrative" : "Use this page as the evidence layer",
      description: thinNarrative
        ? buildPolicyCoverageNote(policy)
        : "This record already has a fuller narrative, but it is still best read alongside the source list, related policies, and broader presidential or thematic context.",
    },
  ];
}

function buildPolicyContextParagraphs(policy, editorial = null) {
  const categoryLabels = takeLabels(policy.categories, (item) => item.name, 4);
  const sourceCount = Number(policy.evidence_summary?.total_sources || 0);
  const relatedPromiseCount = Number((policy.related_promises || []).length || 0);
  const relatedExplainerCount = Number((policy.related_explainers || []).length || 0);

  return filterParagraphs([
    sentenceJoin([
      `${policy.title} is treated here as one evidence-bearing policy record inside the broader EquityStack research graph.`,
      policy.president ? `The page currently connects it to ${policy.president}'s presidential context.` : null,
      categoryLabels.length
        ? `Its clearest public topic links are ${oxfordJoin(categoryLabels)}.`
        : null,
    ]),
    sentenceJoin([
      `${countLabel(sourceCount, "source")} currently support the public evidence layer on this page, alongside ${countLabel(
        relatedPromiseCount,
        "related promise"
      )} and ${countLabel(relatedExplainerCount, "related explainer")}.`,
      `That surrounding structure matters most when the written summary or outcome note is still short.`,
    ]),
    sentenceJoin([
      `The strongest reading comes from comparing the summary, outcome language, source trail, and related records together.`,
      editorial?.overviewSuffix ||
        "That keeps the interpretation tied to the visible record instead of leaning on one paragraph alone.",
    ]),
  ]);
}

function buildPolicyThematicPath(policy, editorial = null) {
  if (editorial?.priorityPath) {
    return editorial.priorityPath;
  }

  const signals = [
    policy.policy_type,
    policy.impact_direction,
    ...(policy.categories || []).map((item) => item.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /law|amendment|voting|rights|civil|court/.test(signals)
  ) {
    return {
      href: "/analysis/civil-rights-laws-by-president",
      label: "Legislation lens",
      title: "Trace civil-rights laws across administrations",
      description:
        "Use the legislation pathway when this record matters most as part of the longer legal history affecting Black Americans.",
    };
  }

  if (
    /housing|education|labor|employment|economic|business|bank|mortgage|opportunity|wealth/.test(
      signals
    )
  ) {
    return {
      href: "/analysis/how-presidents-shaped-black-opportunity",
      label: "Opportunity pathway",
      title: "Review policies affecting access and advancement",
      description:
        "Use the opportunity pathway when the question is about housing, labor, education, investment, or federal access over time.",
    };
  }

  return {
    href: "/analysis/presidential-impact-on-black-americans",
    label: "Impact pathway",
    title: "Explore broader presidential impact on Black Americans",
    description:
      "Use the broader impact page when this policy should be read inside a larger administration-level or cross-administration pattern.",
  };
}

function buildResearchPaths(policy, editorial = null) {
  const paths = [buildPolicyThematicPath(policy, editorial)];

  if (policy.president) {
    paths.push({
      href: `/policies?president=${encodeURIComponent(policy.president)}`,
      label: "Presidential context",
      title: `Browse more policy records under ${policy.president}`,
      description:
        "Use the filtered policy index to see whether this record fits a broader presidential pattern on Black rights, access, or public investment.",
    });
  }

  paths.push({
    href: "/narratives",
    label: "Historical threads",
    title: "Read narrative policy threads",
    description:
      "Narrative pages group policies into larger historical patterns, making it easier to place one record inside a broader Black history or civil-rights arc.",
  });

  paths.push({
    href: "/reports",
    label: "Analysis layer",
    title: "Continue into reports and comparative analysis",
    description:
      "Reports help move from one policy record into cross-administration patterns, score context, and higher-level historical interpretation.",
  });

  paths.push({
    href: "/research",
    label: "Research hub",
    title: "Return to the curated research hub",
    description:
      "Use the research hub when this policy opens into a broader question and you need the strongest next explainer, report, or thematic path.",
  });

  return paths;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const policy = await fetchPolicyDetailBySlug(slug);

  if (!policy) {
    return buildPageMetadata({
      title: "Policy Not Found",
      description: "The requested policy record could not be found.",
      path: `/policies/${slug}`,
    });
  }

  return buildPageMetadata({
    title: policy.title,
    description:
      policy.summary ||
      `Review a policy record on ${policy.title} with impact score, evidence, and historical context affecting Black Americans.`,
    path: `/policies/${policy.slug}`,
    keywords: [
      policy.policy_type,
      policy.president,
      policy.era,
      "legislation affecting Black Americans",
    ].filter(Boolean),
  });
}

export default async function PolicyDetailPage({ params }) {
  const { slug } = await params;
  const policy = await fetchPolicyDetailBySlug(slug);

  if (!policy) {
    notFound();
  }

  const timeline = buildTimeline(policy);
  const score = computePolicyScore(policy);
  const policyPath = `/policies/${policy.slug}`;
  const flagshipEditorial = getFlagshipPolicyEditorial(policy.id);
  const researchPaths = buildResearchPaths(policy, flagshipEditorial);
  const guideCards = buildPolicyGuideCards(policy, flagshipEditorial);
  const thinSummary = isThinText(policy.summary, 140);
  const thinOutcome = isThinText(policy.outcome_summary, 140);
  const contextParagraphs = buildPolicyContextParagraphs(policy, flagshipEditorial);
  const systemicImpact = buildSystemicImpactCard(policy);
  const demographicImpacts = Array.isArray(policy.demographic_impacts)
    ? policy.demographic_impacts
    : [];
  const fundingImpactCount = demographicImpacts.filter((impact) => isFundingImpact(impact)).length;
  const supportingImpactCount = demographicImpacts.length - fundingImpactCount;
  const blackImpactScoreSummary = buildBlackImpactScoreSummary(policy, score);
  const evidenceCoverage = buildEvidenceCoverage({
    sourceCount: Number(policy.sources?.length || policy.evidence_summary?.total_sources || 0),
    demographicImpactCount: demographicImpacts.length,
    fundingImpactCount,
    supportingImpactCount,
    hasPolicyScore: Number.isFinite(Number(score)),
  });
  const evidenceStrengtheningNote = buildEvidenceStrengtheningNote({
    sourceCount: Number(policy.sources?.length || policy.evidence_summary?.total_sources || 0),
    demographicImpactCount: demographicImpacts.length,
    fundingImpactCount,
    supportingImpactCount,
    hasPolicyScore: Number.isFinite(Number(score)),
  });
  const researchCoverage = buildResearchCoverage({
    sourceCount: Number(policy.sources?.length || policy.evidence_summary?.total_sources || 0),
    outcomeCount: Number((policy.scored_outcomes || []).length || policy.outcome_count || 0),
    relatedRecordCount:
      Number(policy.related_promises?.length || 0) +
      Number(policy.related_explainers?.length || 0) +
      Number(policy.related_policies?.length || 0),
    hasScore: Number.isFinite(Number(score)),
    confidenceLabel: policy.evidence_summary?.evidence_strength || null,
  });
  const researchStrengtheningNote = buildResearchStrengtheningNote({
    sourceCount: Number(policy.sources?.length || policy.evidence_summary?.total_sources || 0),
    outcomeCount: Number((policy.scored_outcomes || []).length || policy.outcome_count || 0),
    relatedRecordCount:
      Number(policy.related_promises?.length || 0) +
      Number(policy.related_explainers?.length || 0) +
      Number(policy.related_policies?.length || 0),
    hasScore: Number.isFinite(Number(score)),
  });
  const whyThisScore = buildWhyThisPolicyScore(
    policy,
    score,
    researchCoverage || evidenceCoverage,
    researchStrengtheningNote || evidenceStrengtheningNote
  );
  const policyReferenceSynthesis = buildPolicyReferenceSynthesis({
    policy,
    score,
    blackImpactScoreSummary,
    coverage: researchCoverage || evidenceCoverage,
    strengtheningNote: researchStrengtheningNote || evidenceStrengtheningNote,
    relationships: policy.relationships || [],
    editorial: flagshipEditorial,
  });
  const policyReferenceUtility = buildPolicyReferenceUtility({
    policy,
    score,
    blackImpactScoreSummary,
    coverage: researchCoverage || evidenceCoverage,
  });
  const demographicContextBridge = buildDemographicContextBridge(policy);
  const demographicImpactSections = buildDemographicImpactSections(demographicImpacts);
  const policyComparisonEntries = await buildPolicyComparisonEntries(policy);
  const bestNextReviewItems = buildPolicyNextReviewGuidance({
    policy,
    relationships: policy.relationships || [],
    currentYear: policy.year_enacted,
    editorial: flagshipEditorial,
  });
  const localSectionOffsetClass = "scroll-mt-28 md:scroll-mt-32";
  const localNavigationItems = [
    { href: "#overview", label: "Overview" },
    ...(timeline.length
      ? [{ href: "#timeline", label: "Timeline", count: timeline.length }]
      : []),
    ...(demographicImpacts.length
      ? [
          {
            href: "#demographic-impact",
            label: "Demographic impact",
            count: demographicImpacts.length,
          },
        ]
      : []),
    {
      href: "#evidence",
      label: "Evidence",
      count: Number(policy.sources?.length || 0),
    },
    {
      href: "#related",
      label: "Related",
      count:
        Number(policy.related_promises?.length || 0) +
        Number(policy.related_explainers?.length || 0) +
        Number(policy.relationships?.length || 0),
    },
  ];
  const showLocalNavigation = localNavigationItems.length >= 3;
  const badges = [
    policy.year_enacted ? `Year ${policy.year_enacted}` : null,
    policy.president ? `President: ${policy.president}` : null,
    policy.era ? `Era: ${policy.era}` : null,
    policy.primary_party ? `Party: ${policy.primary_party}` : null,
    policy.policy_type,
    policy.impact_direction,
    isNonStandardSystemicImpact(policy.systemic_impact_category)
      ? `Systemic: ${formatSystemicImpactLabel(policy.systemic_impact_category)}`
      : null,
  ].filter(Boolean);

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/policies", label: "Policies" },
              { label: policy.title },
            ],
            policyPath
          ),
          buildPolicyJsonLd(policy, policy.slug, score),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/policies", label: "Policies" },
          { label: policy.title },
        ]}
      />

      <Panel prominence="primary" className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 border-b border-[var(--line)] p-4 xl:border-b-0 xl:border-r">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Policy record
            </p>
            <h1 className="mt-3 max-w-4xl text-[clamp(1.9rem,5.5vw,3.7rem)] font-semibold leading-[1] tracking-[-0.04em] text-white">
              {policy.title}
            </h1>
            {policy.summary || policy.outcome_summary ? (
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--ink-soft)] md:text-base md:leading-7">
                {policy.summary || policy.outcome_summary}
              </p>
            ) : null}
            {badges.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <StatusPill key={badge} tone="default">
                    {badge}
                  </StatusPill>
                ))}
              </div>
            ) : null}
          </div>
          <aside className="grid content-start gap-3 p-4">
            <MetricCard
              label="Impact Score"
              value={formatScore(score)}
              description="Record-level policy score."
              prominence="primary"
              tone="info"
              showDot
            />
            <MetricCard
              label="Impact direction"
              value={policy.impact_direction || "Unknown"}
              description={policy.policy_type || "Policy record"}
              density="compact"
              tone={getImpactDirectionTone(policy.impact_direction)}
              showDot
            />
          </aside>
        </div>
      </Panel>

      <TrustBar />

      {showLocalNavigation ? (
        <div className="space-y-1.5">
          <p className="px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            On this page
          </p>
          <EquityStackTabbar
            items={localNavigationItems}
            ariaLabel="Policy page sections"
            defaultHref="#overview"
          />
        </div>
      ) : null}

      <Panel id="overview" prominence="primary" className={`${localSectionOffsetClass} overflow-hidden`}>
        <SectionHeader
          eyebrow="Policy takeaway"
          title="The record, classification, and evidence in one view"
          description={buildWhatItMeans(policy)}
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Impact direction"
              value={policy.impact_direction || "Unknown"}
              description={policy.policy_type || "Policy record"}
              tone={getImpactDirectionTone(policy.impact_direction)}
              showDot
            />
            <MetricCard
              label="Impact score"
              value={formatScore(score)}
              description="Record-level policy score, separate from presidential aggregate scoring."
              tone="info"
            />
            <MetricCard
              label="Evidence"
              value={policy.evidence_summary?.evidence_strength || "Limited"}
              description={`${countLabel(policy.evidence_summary?.total_sources || 0, "source")} in the visible trail.`}
              tone={getEvidenceTone(policy.evidence_summary?.evidence_strength)}
            />
            <MetricCard
              label="Completeness"
              value={policy.completeness_summary?.status || "Unknown"}
              description={policy.year_enacted ? `Anchored in ${policy.year_enacted}.` : "No enacted year attached."}
              tone={getCompletenessTone(policy.completeness_summary?.status)}
            />
          </div>
          <WhyThisScorePanel
            eyebrow="Reference summary"
            title="Read this record in one pass"
            summary={policyReferenceSynthesis?.summary}
            items={policyReferenceSynthesis?.items}
            note={policyReferenceSynthesis?.note}
            actionHref="#evidence"
            actionLabel="Jump to evidence"
          />
          {blackImpactScoreSummary ? (
            <Panel padding="md" prominence="primary" className="space-y-4">
              <StatusPill tone={getImpactDirectionTone(blackImpactScoreSummary.direction)}>
                Black Impact Score
              </StatusPill>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,13rem)_1fr] lg:items-start">
                <div className="space-y-2">
                  <p className="text-3xl font-semibold tracking-[-0.04em] text-white">
                    {blackImpactScoreSummary.display_score}
                  </p>
                  <p className="text-sm leading-6 text-[var(--ink-soft)]">
                    {blackImpactScoreSummary.direction} impact
                  </p>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    Weighted record score {formatScore(blackImpactScoreSummary.raw_score)} / {POLICY_IMPACT_SCORE_MAX}
                  </p>
                </div>
                <div className="space-y-3">
                  <p className="text-sm leading-7 text-[var(--ink-soft)]">
                    {blackImpactScoreSummary.explanation}
                  </p>
                  <p className="text-sm leading-7 text-[var(--ink-soft)]">
                    {blackImpactScoreSummary.factor_line}.
                  </p>
                  {blackImpactScoreSummary.evidence_label ? (
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">
                      Current evidence read: {String(blackImpactScoreSummary.evidence_label).toLowerCase()}.
                    </p>
                  ) : null}
                </div>
              </div>
            </Panel>
          ) : null}
          <WhyThisScorePanel
            eyebrow="Why this score?"
            title="What is doing the most work in this score"
            summary={whyThisScore?.summary}
            items={whyThisScore?.items}
            actionHref="/research/how-black-impact-score-works"
            actionLabel="Read the scoring method"
          />
          <ResearchCoveragePanel
            coverage={researchCoverage || evidenceCoverage}
            strengtheningNote={researchStrengtheningNote || evidenceStrengtheningNote}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Panel padding="md">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                Evidence layer
              </p>
              <h3 className="mt-2 text-base font-semibold text-white">
                What this page is for
              </h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Policy detail pages are the core evidence layer of EquityStack. Each one is meant to answer what happened, how the record is classified, and why it matters for Black Americans.
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Use this page when you want to verify a law, executive action, or court decision directly before moving into broader presidential, legislative, or historical comparisons.
              </p>
            </Panel>
            <Panel padding="md">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                Public read
              </p>
              <h3 className="mt-2 text-base font-semibold text-white">
                Why this page matters
              </h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Search visitors often arrive with a broad question about civil-rights law, presidential impact, or historical harm. This page is where that question should become concrete through summary, score, sources, and related records.
              </p>
            </Panel>
            <ShareCardPanel
              pagePath={policyPath}
              cardPath={buildPolicyCardHref(policy)}
              title="Share this policy record or its card"
            />
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-3">
        {guideCards.map((item) => (
          <Panel
            key={item.title}
            padding="md"
            className="space-y-3"
          >
            <StatusPill tone="info">{item.eyebrow}</StatusPill>
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
          </Panel>
        ))}
      </section>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Context and background"
          title="What this policy page adds beyond the headline summary"
          description="This section helps keep shorter policy narratives useful by framing them with the supporting evidence, relationships, and record structure already present on the page."
        />
        <div className="grid gap-4 p-4">
          {contextParagraphs.map((paragraph, index) => (
            <p key={`${policy.id}-context-${index}`} className="text-sm leading-8 text-[var(--ink-soft)]">
              {paragraph}
            </p>
          ))}
        </div>
      </Panel>

      <Panel id="summary" className={`${localSectionOffsetClass} overflow-hidden`}>
        <SectionHeader
          eyebrow="Plain-language summary"
          title="What happened and why it matters"
          description="This page is the proof layer of the public site. It should let a reader move from score into explanation, evidence, and related records without guessing."
        />
        <div className="space-y-4 p-4">
          <Panel padding="md">
            <StatusPill tone="info">What happened</StatusPill>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {policy.summary || "A plain-language summary has not been published for this record yet."}
            </p>
            {thinSummary ? (
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {buildPolicyRecordOverview(policy, flagshipEditorial)}
              </p>
            ) : null}
            <div className="mt-6">
              <StatusPill tone={getImpactDirectionTone(policy.impact_direction)}>
                Why it matters
              </StatusPill>
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {buildWhyItMatters(policy)}
            </p>
            {thinSummary || thinOutcome ? (
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {buildPolicyCoverageNote(policy)}
              </p>
            ) : null}
            {policy.categories?.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {policy.categories.map((category) => (
                  <StatusPill key={category.name}>
                    {category.name}
                  </StatusPill>
                ))}
              </div>
            ) : null}
          </Panel>

          <Panel padding="md" prominence="primary" className="space-y-4">
            <StatusPill tone={getImpactDirectionTone(policy.impact_direction)}>
              What this means
            </StatusPill>
            <h2 className="text-2xl font-semibold text-white">Impact on Black Americans</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
              {buildWhatItMeans(policy)}
            </p>
            {thinOutcome ? (
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {sentenceJoin([
                  buildPolicyRecordOverview(policy, flagshipEditorial),
                  "Use the related promises, reports, and policy lineage below if you need fuller context than the current outcome summary provides.",
                ])}
              </p>
            ) : null}
          </Panel>

          {timeline.length ? (
            <div id="timeline" className={localSectionOffsetClass}>
              <PolicyTimeline items={timeline} />
            </div>
          ) : null}

          <SourceTrustPanel
            sourceCount={policy.evidence_summary?.total_sources}
            sourceQuality={policy.evidence_summary?.evidence_strength}
            completenessLabel={policy.completeness_summary?.status}
            summary="Policy pages keep score, evidence, and completeness side by side so users can evaluate what is known, what is sourced, and what still needs work."
          />
          {demographicImpacts.length ? (
            <Panel
              id="demographic-impact"
              padding="md"
              className={`${localSectionOffsetClass} space-y-4`}
            >
              <SectionHeader
                eyebrow="Structured record"
                title="Demographic impact"
                description="When EquityStack has structured demographic impact rows for a policy, they appear here as a bounded evidence layer tied to the source record."
              />
              {demographicImpactSections.length > 1 ? (
                <div className="space-y-8">
                  {demographicImpactSections.map((section) => (
                    <div key={section.key} className="space-y-4">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-white">
                          {section.title}
                        </h3>
                        {section.description ? (
                          <p className="text-sm leading-7 text-[var(--ink-soft)]">
                            {section.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {section.items.map((impact) => (
                          <DemographicImpactCard
                            key={impact.id || `${impact.metric_name}-${impact.demographic_group}`}
                            impact={impact}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {demographicImpacts.map((impact) => (
                    <DemographicImpactCard
                      key={impact.id || `${impact.metric_name}-${impact.demographic_group}`}
                      impact={impact}
                    />
                  ))}
                </div>
              )}
              {demographicContextBridge ? (
                <Panel padding="md" className="space-y-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    Related context
                  </p>
                  <div className="space-y-2 text-sm leading-7 text-[var(--ink-soft)]">
                    {demographicContextBridge.explainer ? (
                      <p>
                        For broader context, read{" "}
                        <Link
                          href={`/explainers/${demographicContextBridge.explainer.slug}`}
                          className="font-semibold text-white underline decoration-white/20 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
                        >
                          {demographicContextBridge.explainer.title}
                        </Link>
                        {demographicContextBridge.additionalExplainerCount > 0
                          ? ` and ${countLabel(
                              demographicContextBridge.additionalExplainerCount,
                              "other linked explainer"
                            )}`
                          : ""}
                        .
                      </p>
                    ) : null}
                    {demographicContextBridge.sourceCount > 1 ? (
                      <p>
                        The full{" "}
                        <Link
                          href="#evidence"
                          className="font-semibold text-white underline decoration-white/20 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
                        >
                          source trail
                        </Link>{" "}
                        below shows the wider evidence base behind this record, beyond the sources attached to individual impact rows.
                      </p>
                    ) : null}
                  </div>
                </Panel>
              ) : null}
            </Panel>
          ) : null}
          {policyComparisonEntries.length ? (
            <Panel padding="md" className="space-y-4">
              <div className="space-y-1">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  Compare this policy
                </p>
                <h3 className="text-lg font-semibold text-white">
                  Compare with related policies
                </h3>
                <p className="text-sm leading-7 text-[var(--ink-soft)]">
                  Use a nearby record when you want to compare Black impact, direction, and evidence side by side instead of reading this policy in isolation.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {policyComparisonEntries.map((item) => (
                  <Panel
                    key={item.id}
                    as={Link}
                    href={item.compare_href}
                    padding="md"
                    interactive
                    className="flex h-full flex-col"
                  >
                    <StatusPill tone="default">{item.eyebrow}</StatusPill>
                    <h3 className="mt-3 text-lg font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                      {item.description}
                    </p>
                    <p className="mt-auto pt-4 text-[12px] font-semibold text-[var(--ink-soft)]">
                      Open side-by-side comparison
                    </p>
                  </Panel>
                ))}
              </div>
            </Panel>
          ) : null}
          <ScoreExplanation title="How to interpret this policy record" />
          {systemicImpact ? (
            <Panel padding="md" className="space-y-4">
              <StatusPill tone="verified">Systemic impact</StatusPill>
              <h3 className="mt-3 text-lg font-semibold text-white">
                {systemicImpact.label} structural weight
              </h3>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="verified">
                  {systemicImpact.label}
                </StatusPill>
                <StatusPill tone="info">
                  Systemic multiplier {formatSystemicMultiplier(systemicImpact.multiplier)}
                </StatusPill>
              </div>
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                {systemicImpact.summary}
              </p>
            </Panel>
          ) : null}
          <CitationNote
            title="How to reference this record"
            description={
              flagshipEditorial?.citationDescription ||
              policyReferenceUtility.description
            }
            referenceLine={policyReferenceUtility.referenceLine}
            items={policyReferenceUtility.items}
          />
          <MethodologyCallout description="Impact Score is a structured record-level metric. The presidential Black Impact Score is a separate aggregate model built from outcomes, confidence, and time normalization." />
        </div>
      </Panel>

      <Panel id="evidence" className={`${localSectionOffsetClass} overflow-hidden`}>
        <SectionHeader
          eyebrow="Evidence"
          title="Source trail"
          description="Evidence should be visible immediately, not hidden behind a second click. Open the source list first if you want to verify the record before reading related content."
        />
        <div className="p-4">
          {policy.sources?.length ? (
            <EvidenceSourceList items={policy.sources} />
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No evidence sources are attached to this policy record yet. Use related records or methodology for broader context.
            </Panel>
          )}
        </div>
      </Panel>

      <Panel id="related" className={`${localSectionOffsetClass} overflow-hidden`}>
        <SectionHeader
          eyebrow="Continue exploring"
          title="Promises, explainers, reports, and research paths"
          description="Start with the curated next-step panel first. The linked records and context cards below keep the broader related set visible without forcing one path."
        />
        <div className="space-y-4 p-4">
          <DiscoveryGuidancePanel
            eyebrow="Best context to read next"
            title="Start with this curated next step before browsing the full linked set"
            description="Use this short path when you want the clearest next click first. The full promise, explainer, report, and research links remain visible below."
            items={bestNextReviewItems}
          />
          {(policy.related_promises || []).length ? (
            <PromiseResultsTable items={policy.related_promises} buildHref={(item) => `/promises/${item.slug}`} />
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No related promise records are linked to this policy yet.
            </Panel>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {(policy.related_explainers || []).map((item) => (
              <Panel
                key={item.slug}
                as={Link}
                href={`/explainers/${item.slug}`}
                padding="md"
                interactive
              >
                <StatusPill tone="info">
                  {item.category || "Explainer"}
                </StatusPill>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.summary}</p>
              </Panel>
            ))}
            <Panel as={Link} href="/reports/black-impact-score" padding="md" interactive>
              <StatusPill tone="info">Related report</StatusPill>
              <h3 className="mt-3 text-lg font-semibold text-white">Black Impact Score</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Move from this policy proof page into the flagship report when you want presidential or historical comparison context.
              </p>
            </Panel>
            {researchPaths.map((item) => (
              <Panel
                key={item.href}
                as={Link}
                href={item.href}
                padding="md"
                interactive
              >
                <StatusPill tone="default">
                  {item.label}
                </StatusPill>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
              </Panel>
            ))}
          </div>
        </div>
      </Panel>

      <PolicyLineagePanel
        relationships={policy.relationships || []}
        currentYear={policy.year_enacted}
      />
    </main>
  );
}
