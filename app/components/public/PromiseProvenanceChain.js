import Link from "next/link";
import { countLabel } from "@/lib/editorial-depth";
import { buildPolicySlug } from "@/lib/public-site-data";
import { Panel, StatusPill } from "@/app/components/dashboard/primitives";

function takeTitles(items = [], fallbackPrefix) {
  return (items || [])
    .slice(0, 3)
    .map((item, index) => {
      const title =
        item?.title ||
        item?.name ||
        item?.metric_name ||
        item?.promise_text ||
        item?.summary;
      return title || `${fallbackPrefix} ${index + 1}`;
    });
}

function truncateText(value, maxLength = 220) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function ProvenanceStep({
  index,
  title,
  description,
  items = [],
  links = [],
}) {
  return (
    <Panel padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="info">Step {index}</StatusPill>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <p className="text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <StatusPill key={`${title}-${item}`} tone="default">
              {item}
            </StatusPill>
          ))}
        </div>
      ) : null}
      {links.length ? (
        <div className="flex flex-wrap gap-2">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-8 items-center rounded-md border border-[var(--line)] bg-[rgba(18,31,49,0.58)] px-3 text-xs font-semibold text-white transition-[background-color,border-color] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

export default function PromiseProvenanceChain({
  promise,
  blackImpactSummary = null,
  demographicImpacts = [],
}) {
  const actions = Array.isArray(promise?.actions) ? promise.actions : [];
  const outcomes = Array.isArray(promise?.outcomes) ? promise.outcomes : [];
  const relatedPolicies = Array.isArray(promise?.related_policies)
    ? promise.related_policies
    : [];
  const impactCount = Array.isArray(demographicImpacts) ? demographicImpacts.length : 0;

  const steps = [
    {
      index: 1,
      title: "Promise made",
      description:
        truncateText(promise?.promise_text || promise?.summary) ||
        "The promise statement is visible above even when the longer rationale is still thin.",
      items: [
        promise?.status ? `Status: ${promise.status}` : null,
        promise?.confidence_label ? `Confidence: ${promise.confidence_label}` : null,
      ].filter(Boolean),
    },
    {
      index: 2,
      title: "Actions taken",
      description: actions.length
        ? `${countLabel(actions.length, "documented action")} is currently linked to this promise, showing how the commitment moved into visible administrative, legislative, or public steps.`
        : "No documented action is linked to this promise yet in the current public dataset.",
      items: takeTitles(actions, "Action"),
    },
    {
      index: 3,
      title: "Observed outcomes",
      description: outcomes.length
        ? `${countLabel(outcomes.length, "linked outcome")} currently helps explain how the promise translated into measurable or classified follow-through.`
        : "No linked outcomes are attached to this promise yet.",
      items: takeTitles(outcomes, "Outcome"),
    },
    {
      index: 4,
      title: "Related policies",
      description: relatedPolicies.length
        ? `${countLabel(relatedPolicies.length, "related policy")} currently carries the most concrete implementation record behind this promise.`
        : "No related policy has been linked to this promise yet.",
      links: relatedPolicies.slice(0, 3).map((item) => ({
        href: `/policies/${buildPolicySlug(item)}`,
        label: item.title || "Policy record",
      })),
    },
    {
      index: 5,
      title: "Black-impact read",
      description: blackImpactSummary
        ? `${blackImpactSummary.direction_label} across ${countLabel(
            blackImpactSummary.outcome_count,
            "scored outcome"
          )}, kept separate from the tracker status.`
        : impactCount
          ? `${countLabel(
              impactCount,
              "demographic-impact row"
            )} is attached to this promise record to show the current Black-impact evidence layer.`
          : "No promise-level Black-impact analysis has been added yet.",
      items: blackImpactSummary
        ? [
            blackImpactSummary.direction_label,
            blackImpactSummary.confidence_label
              ? `${blackImpactSummary.confidence_label} confidence`
              : null,
          ].filter(Boolean)
        : takeTitles(demographicImpacts, "Impact row"),
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {steps.map((step) => (
        <ProvenanceStep key={step.index} {...step} />
      ))}
    </div>
  );
}
