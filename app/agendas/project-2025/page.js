import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  getPromiseStatusTone,
  MetricCard,
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import { buildPageMetadata } from "@/lib/metadata";
import { getAgendaPageData } from "@/lib/agendas";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Project 2025 Tracker",
  description:
    "Track Project 2025 as an external governing blueprint and compare selected agenda items with linked EquityStack action records without merging the agenda into policy scoring.",
  path: "/agendas/project-2025",
  keywords: [
    "Project 2025 tracker",
    "external blueprint tracker",
    "agenda tracking",
    "linked policy actions",
  ],
});

function formatPublishedDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildPublicRecordHref(entityType, slug) {
  const normalizedType = String(entityType || "").trim().toLowerCase();
  const normalizedSlug = String(slug || "").trim();

  if (!normalizedSlug) {
    return null;
  }

  if (normalizedType === "promise") return `/promises/${normalizedSlug}`;
  if (normalizedType === "policy") return `/policies/${normalizedSlug}`;
  if (normalizedType === "bill") return `/bills/${normalizedSlug}`;
  return null;
}

function AgendaItemCard({ item, index }) {
  const visibleLinkedActions = item.linked_actions.slice(0, 2);
  const hiddenLinkedActionCount = item.linked_actions.length - visibleLinkedActions.length;

  return (
    <Panel
      id={`agenda-item-${item.id}`}
      padding="md"
      className="space-y-4 scroll-mt-28 md:scroll-mt-32"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Item {String(index + 1).padStart(2, "0")}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">{item.title}</h2>
        </div>
        <StatusPill tone={item.status_tone}>{item.status_label}</StatusPill>
      </div>
      <p className="text-sm leading-7 text-[var(--ink-soft)]">{item.summary}</p>
      <div className="flex flex-wrap gap-2">
        <StatusPill tone="default">{item.policy_domain_label || item.policy_domain}</StatusPill>
        <StatusPill tone="info">{item.action_type_label || item.action_type}</StatusPill>
        <StatusPill tone={item.linked_action_count ? "verified" : "default"}>
          {item.linked_action_count} linked record{item.linked_action_count === 1 ? "" : "s"}
        </StatusPill>
        {item.linked_action_types.map((label) => (
          <StatusPill key={`${item.id}-${label}`} tone="default">
            {label}
          </StatusPill>
        ))}
      </div>
      {visibleLinkedActions.length ? (
        <p className="text-xs leading-6 text-[var(--ink-soft)]">
          <span className="font-semibold text-white">Linked records:</span>{" "}
          {visibleLinkedActions.map((link, index) => (
            <span key={`${item.id}-${link.entity_type}-${link.entity_id}`}>
              {index > 0 ? ", " : ""}
              {buildPublicRecordHref(link.entity_type, link.record.slug) ? (
                <Link
                  href={buildPublicRecordHref(link.entity_type, link.record.slug)}
                  className="font-medium text-white hover:text-white"
                >
                  {link.record.title}
                </Link>
              ) : (
                <span className="font-medium text-white">{link.record.title}</span>
              )}
            </span>
          ))}
          {hiddenLinkedActionCount > 0 ? (
            <span className="text-[var(--ink-muted)]">
              {" "}
              +{hiddenLinkedActionCount} more grounded record{hiddenLinkedActionCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
      ) : null}
    </Panel>
  );
}

function formatCountLabel(value, singular, plural = `${singular}s`) {
  const count = Number(value || 0);
  return `${count} ${count === 1 ? singular : plural}`;
}

function LinkedRecordCard({ record }) {
  return (
    <Panel as={Link} href={record.href} padding="md" interactive className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <StatusPill tone="info">{record.entity_type_label}</StatusPill>
        <StatusPill tone={getPromiseStatusTone(record.status)}>{record.status || "Unknown"}</StatusPill>
        {record.topic ? <StatusPill tone="default">{record.topic}</StatusPill> : null}
        <StatusPill tone="verified">
          {formatCountLabel(record.linked_agenda_items.length, "agenda item")}
        </StatusPill>
        <StatusPill tone="default">{formatCountLabel(record.action_count, "action")}</StatusPill>
        <StatusPill tone="default">{formatCountLabel(record.outcome_count, "outcome")}</StatusPill>
        <StatusPill tone="default">{formatCountLabel(record.source_count, "source")}</StatusPill>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{record.title}</h3>
        {record.summary ? (
          <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{record.summary}</p>
        ) : null}
      </div>
      <div className="grid gap-2 text-xs leading-6 text-[var(--ink-soft)]">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Why this record is linked
        </p>
        {record.linked_agenda_items.map((item) => (
          <p key={`${record.entity_type}-${record.slug || record.id}-${item.id}`}>
            <Link href={item.href} className="font-medium text-white hover:text-white">
              {item.title}
            </Link>
            <span className="text-[var(--ink-muted)]">
              {" "}
              • {item.policy_domain_label || item.policy_domain} • {item.relationship_label} •{" "}
              {item.confidence_label} confidence
            </span>
            {item.reasoning ? ` — ${item.reasoning}` : ""}
          </p>
        ))}
      </div>
    </Panel>
  );
}

function WatchTile({ title, text }) {
  return (
    <Panel padding="md">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {title}
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{text}</p>
    </Panel>
  );
}

export default async function Project2025AgendaPage() {
  const data = await getAgendaPageData("project-2025");

  if (!data) {
    notFound();
  }

  const publishedDate = formatPublishedDate(data.agenda.published_at);
  const topLinkedItem = data.watch.top_linked_items[0] || null;
  const unlinkedPreview = data.watch.unlinked_items.map((item) => item.title).join(", ");
  const statusCards = [
    {
      label: "Tracked",
      value: String(data.metrics.status_breakdown.tracked || 0),
      tone: "default",
    },
    {
      label: "Attempted",
      value: String(data.metrics.status_breakdown.attempted || 0),
      tone: "info",
    },
    {
      label: "Partial",
      value: String(data.metrics.status_breakdown.partial || 0),
      tone: "warning",
    },
    {
      label: "Implemented",
      value: String(data.metrics.status_breakdown.implemented || 0),
      tone: "verified",
    },
  ];

  return (
    <main className="space-y-4">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Agendas" },
          { label: "Project 2025 Tracker" },
        ]}
      />

      <Panel prominence="primary" className="overflow-hidden">
        <div className="p-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Tracked agenda
          </p>
          <h1 className="page-title mt-3">Project 2025 Tracker</h1>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-[var(--ink-soft)] md:text-base md:leading-7">
            {data.agenda.summary}
          </p>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--ink-soft)]">
            The tracker follows where Project 2025 proposals show up in real EquityStack records.
            Those linked records carry the evidence and public status. The blueprint itself does
            not receive a Black Impact Score.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <StatusPill tone="default">{data.agenda.publisher}</StatusPill>
            <StatusPill tone="info">External blueprint</StatusPill>
            {publishedDate ? (
              <StatusPill tone="default">Published {publishedDate}</StatusPill>
            ) : null}
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Agenda items"
          value={String(data.metrics.total_items)}
          description="Tracked Project 2025 agenda items in this public slice."
          tone="default"
        />
        <MetricCard
          label="Items with linked records"
          value={String(data.metrics.items_with_linked_actions)}
          description="Agenda items that currently connect to grounded visible EquityStack records."
          tone="verified"
        />
        <MetricCard
          label="Items still unlinked"
          value={String(data.metrics.items_without_linked_actions)}
          description="Tracked agenda items that do not yet have a grounded public record attached."
          tone="default"
        />
        <MetricCard
          label="Tracked-only items"
          value={String(data.metrics.tracked_count)}
          description="Items still in watch status without a stronger implementation label yet."
          tone="info"
        />
      </section>

      <Panel padding="md">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              Status snapshot
            </p>
            <h2 className="text-base font-semibold text-white">Agenda status breakdown</h2>
          </div>
          <p className="max-w-2xl text-[12px] leading-5 text-[var(--ink-soft)]">
            These agenda-only labels summarize how far this public slice has moved from watchlist
            tracking into attempted, partial, or implemented overlap with real records.
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {statusCards.map((item) => (
            <MetricCard
              key={item.label}
              label={item.label}
              value={item.value}
              tone={item.tone}
              density="compact"
              showDot
            />
          ))}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Agenda items"
          title="Tracked Project 2025 items"
          description="Each row tracks a proposal area from the external blueprint. Linked-record counts reflect real EquityStack entities already attached to that item, not enactment of the blueprint itself."
        />
        <div className="grid gap-4 p-4">
          {data.items.map((item, index) => (
            <AgendaItemCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Implementation watch"
          title="What to watch in this slice"
          description="A compact read on where grounded overlap is strongest and where the tracker still lacks linked public records."
        />
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <WatchTile
            title="Most linked now"
            text={
              topLinkedItem
                ? `${topLinkedItem.title} currently has the strongest verified overlap in this slice with ${formatCountLabel(topLinkedItem.linked_action_count, "linked record")}.`
                : "No agenda item currently has a verified linked record."
            }
          />
          <WatchTile
            title="Still unlinked"
            text={
              data.watch.unlinked_count
                ? `${formatCountLabel(data.watch.unlinked_count, "agenda item")} still have no grounded linked record yet, including ${unlinkedPreview}.`
                : "Every agenda item in this slice now has at least one grounded linked record."
            }
          />
          <WatchTile
            title="Implementation posture"
            text={
              data.metrics.implemented_count
                ? `${formatCountLabel(data.metrics.implemented_count, "agenda item")} are already marked implemented in this agenda layer.`
                : "No agenda item is marked implemented yet. The current public slice remains concentrated in tracked, attempted, and partial overlap."
            }
          />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Linked actions"
          title="Verified linked EquityStack records"
          description="These are the separate public records where grounded overlap currently exists. Open them to inspect evidence, status, and implementation detail directly."
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="verified">
              {formatCountLabel(data.metrics.total_linked_records, "linked record")}
            </StatusPill>
            <StatusPill tone="verified">
              {formatCountLabel(data.metrics.total_linked_connections, "verified linkage")}
            </StatusPill>
            {Number(data.metrics.linked_record_type_counts.promise || 0) > 0 ? (
              <StatusPill tone="default">
                {formatCountLabel(data.metrics.linked_record_type_counts.promise, "promise record")}
              </StatusPill>
            ) : null}
            <StatusPill tone="default">
              {formatCountLabel(data.metrics.domain_count, "policy domain")}
            </StatusPill>
          </div>
          <Panel padding="md" className="text-sm leading-7 text-[var(--ink-soft)]">
            Verified public links in this slice currently resolve to Promise Tracker records. Policy
            and bill records will appear here only when the repository has canonical identifiers for
            them. Cards are ordered by how many agenda items they currently touch.
          </Panel>
          {data.linked_actions_preview.records.length ? (
            <div className="grid gap-4">
              {data.linked_actions_preview.records.map((record) => (
                <LinkedRecordCard
                  key={`${record.entity_type}-${record.slug || record.id}`}
                  record={record}
                />
              ))}
            </div>
          ) : (
            <Panel
              padding="md"
              className="border-dashed text-sm leading-7 text-[var(--ink-soft)]"
            >
              No verified linked records are attached to this agenda slice yet. The tracker still
              keeps agenda items visible so readers can see what is being watched before grounded
              record overlap is published.
            </Panel>
          )}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Methodology"
          title="How this tracker should be read"
          description="This page tracks verified overlap, not enactment of the blueprint itself."
        />
        <div className="grid gap-4 p-4 text-sm leading-7 text-[var(--ink-soft)]">
          <p>
            Project 2025 is an external governing blueprint, not enacted policy by itself.
          </p>
          <p>
            Linked records mean EquityStack has a grounded public record that overlaps with an
            agenda item. Those records remain separate promises, policies, or bills with their own
            evidence and status.
          </p>
          <p>
            Agenda items are not scored directly because the blueprint is not government action.
            Black Impact Score stays attached only to record types that already support it.
          </p>
        </div>
      </Panel>
    </main>
  );
}
