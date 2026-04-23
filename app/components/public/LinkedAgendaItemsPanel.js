import Link from "next/link";
import {
  Panel,
  StatusPill,
  getConfidenceTone,
} from "@/app/components/dashboard/primitives";

export default function LinkedAgendaItemsPanel({
  items = [],
  title = "Linked Agenda Items",
  description =
    "This record is linked to one or more tracked external agenda items. The agenda itself is not treated as enacted policy, and it does not receive a Black Impact Score.",
}) {
  if (!items.length) {
    return null;
  }

  return (
    <Panel padding="md" className="space-y-4">
      <div className="space-y-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Agenda linkage
        </p>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <Panel
            key={`${item.agenda_slug}-${item.id}-${item.relationship}`}
            as={Link}
            href={item.href}
            padding="md"
            interactive
          >
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="info">{item.agenda_name}</StatusPill>
              <StatusPill tone={item.status_tone}>{item.status_label}</StatusPill>
              <StatusPill tone="default">{item.policy_domain_label || item.policy_domain}</StatusPill>
              <StatusPill tone="default">{item.action_type_label || item.action_type}</StatusPill>
              <StatusPill tone="default">{item.relationship_label}</StatusPill>
              <StatusPill tone={getConfidenceTone(item.confidence_label)}>
                {item.confidence_label} confidence
              </StatusPill>
            </div>
            <h4 className="mt-3 text-base font-semibold text-white">{item.title}</h4>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{item.summary}</p>
          </Panel>
        ))}
      </div>
    </Panel>
  );
}
