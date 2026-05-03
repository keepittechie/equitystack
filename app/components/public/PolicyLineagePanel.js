import Link from "next/link";
import { Panel, SectionHeader, StatusPill, getImpactDirectionTone } from "@/app/components/dashboard/primitives";
import { buildPolicySlug } from "@/lib/public-site-data";
import {
  buildPolicyNextRecordSuggestions,
  buildPolicyRelationshipClusterSummary,
  buildPolicyRelationshipClusters,
  formatPolicyRelationshipTypeLabel,
  getPolicyRelationshipTone,
  getPolicyTemporalContextLabel,
  summarizePolicyRelationshipContinuity,
} from "@/lib/policyRelationships";

function sortRelationships(relationships = []) {
  return relationships.slice().sort((left, right) => {
    const leftYear = Number(left.related_policy_year || 0);
    const rightYear = Number(right.related_policy_year || 0);

    if (leftYear !== rightYear) {
      return leftYear - rightYear;
    }

    return String(left.related_policy_title || "").localeCompare(
      String(right.related_policy_title || "")
    );
  });
}

export default function PolicyLineagePanel({
  relationships = [],
  currentYear = null,
}) {
  if (!relationships.length) {
    return null;
  }

  const ordered = sortRelationships(relationships);
  const continuitySummary = summarizePolicyRelationshipContinuity(ordered);
  const clusterSummary = buildPolicyRelationshipClusterSummary(ordered);
  const clusters = buildPolicyRelationshipClusters(ordered);
  const nextRecords = buildPolicyNextRecordSuggestions(ordered, currentYear);

  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        eyebrow="Historical continuity"
        title="See this record in the surrounding policy thread"
        description={
          clusterSummary
            ? `${continuitySummary} ${clusterSummary}`
            : continuitySummary
        }
      />
      {clusters.length ? (
        <div className="flex flex-wrap gap-2 px-4 pb-0">
          {clusters.map((item) => (
            <StatusPill
              key={`${item.kind}-${item.label}`}
              tone={item.kind === "era" ? "default" : "info"}
            >
              {item.kind === "era" ? `${item.label} context` : `${item.label} thread`}
            </StatusPill>
          ))}
        </div>
      ) : null}
      {nextRecords.length ? (
        <div className="grid gap-4 px-4 pt-4 md:grid-cols-2">
          {nextRecords.map((item) => (
            <Panel
              as={Link}
              key={`next-${item.related_policy_id}-${item.relationship_type}`}
              href={`/policies/${buildPolicySlug({
                id: item.related_policy_id,
                title: item.related_policy_title,
              })}`}
              padding="md"
              interactive
            >
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                Best next record in this cluster
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone={getPolicyRelationshipTone(item.relationship_type)}>
                  {formatPolicyRelationshipTypeLabel(item.relationship_type)}
                </StatusPill>
                {item.related_policy_year ? (
                  <StatusPill tone="default">{item.related_policy_year}</StatusPill>
                ) : null}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-white">
                {item.related_policy_title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {item.notes ||
                  "This is one of the closest linked records in the current lineage thread."}
              </p>
            </Panel>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 p-4 md:grid-cols-2">
        {ordered.map((item) => {
          const temporalLabel = getPolicyTemporalContextLabel(
            item.related_policy_year,
            currentYear
          );

          return (
            <Panel
              as={Link}
              key={`${item.related_policy_id}-${item.relationship_type}`}
              href={`/policies/${buildPolicySlug({
                id: item.related_policy_id,
                title: item.related_policy_title,
              })}`}
              padding="md"
              interactive
              className="h-full"
            >
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={getPolicyRelationshipTone(item.relationship_type)}>
                  {formatPolicyRelationshipTypeLabel(item.relationship_type)}
                </StatusPill>
                {temporalLabel ? (
                  <StatusPill tone="default">{temporalLabel}</StatusPill>
                ) : null}
                {item.related_policy_year ? (
                  <StatusPill tone="default">{item.related_policy_year}</StatusPill>
                ) : null}
                {item.related_policy_impact_direction ? (
                  <StatusPill tone={getImpactDirectionTone(item.related_policy_impact_direction)}>
                    {item.related_policy_impact_direction}
                  </StatusPill>
                ) : null}
                {item.related_policy_type ? (
                  <StatusPill tone="default">{item.related_policy_type}</StatusPill>
                ) : null}
                {item.related_policy_era ? (
                  <StatusPill tone="default">{item.related_policy_era}</StatusPill>
                ) : null}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-white">
                {item.related_policy_title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {item.notes ||
                  "Open the related record for fuller historical context, evidence, and linked records."}
              </p>
            </Panel>
          );
        })}
      </div>
    </Panel>
  );
}
