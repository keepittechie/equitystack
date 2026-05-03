import Link from "next/link";
import {
  Panel,
  StatusPill,
  getConfidenceTone,
} from "@/app/components/dashboard/primitives";

function formatPolicyLabel(value) {
  return String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function truncateText(value, maxLength = 180) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim().replace(/[.,;:\s]+$/, "")}...`;
}

function getPolicyTitle(item) {
  return item.policy_title || item.title || `Policy ${item.policy_id}`;
}

export default function LinkedPoliciesForCasePanel({
  items = [],
  title = "Linked Policies",
  description =
    "Verified related policy records connected through the case-policy relationship layer.",
  limit = 5,
}) {
  const visibleItems = items.filter(Boolean).slice(0, limit);

  if (!visibleItems.length) {
    return null;
  }

  return (
    <Panel padding="md" className="space-y-4">
      <div className="space-y-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Legal relationship
        </p>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      </div>
      <div className="grid gap-3">
        {visibleItems.map((item) => {
          const content = (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="info">Related policy record</StatusPill>
                {item.policy_domain ? (
                  <StatusPill tone="default">
                    {formatPolicyLabel(item.policy_domain)}
                  </StatusPill>
                ) : null}
                <StatusPill tone="default">
                  {item.relationship_label || formatPolicyLabel(item.relationship)}
                </StatusPill>
                {item.confidence ? (
                  <StatusPill tone={getConfidenceTone(item.confidence)}>
                    {formatPolicyLabel(item.confidence)} confidence
                  </StatusPill>
                ) : null}
              </div>
              <h4 className="mt-3 text-base font-semibold text-white">
                {getPolicyTitle(item)}
              </h4>
              {item.reasoning ? (
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  {truncateText(item.reasoning)}
                </p>
              ) : null}
            </>
          );

          if (item.href) {
            return (
              <Panel
                key={`${item.policy_id}-${item.relationship}`}
                as={Link}
                href={item.href}
                padding="md"
                interactive
              >
                {content}
              </Panel>
            );
          }

          return (
            <Panel key={`${item.policy_id}-${item.relationship}`} padding="md">
              {content}
            </Panel>
          );
        })}
      </div>
    </Panel>
  );
}

