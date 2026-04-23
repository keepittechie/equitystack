import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgendaReviewData } from "@/lib/agendas";

export const dynamic = "force-dynamic";

function Badge({ children, tone = "default", mono = false }) {
  const palette =
    tone === "danger"
      ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] text-[var(--danger)]"
      : tone === "warning"
        ? "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] text-[var(--warning)]"
        : tone === "success" || tone === "verified"
          ? "border-[var(--admin-success-line)] bg-[var(--admin-success-surface)] text-[var(--success)]"
          : tone === "info"
            ? "border-[var(--admin-line-strong)] bg-[var(--admin-surface)] text-[var(--admin-text)]"
          : "border-[var(--admin-line)] bg-[var(--admin-surface-muted)] text-[var(--admin-text-soft)]";

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${palette}${mono ? " font-mono" : ""}`}
    >
      {children}
    </span>
  );
}

function MetricCard({ label, value, note }) {
  return (
    <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
      <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
        {label}
      </p>
      <div className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">
        {value}
      </div>
      {note ? (
        <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">{note}</p>
      ) : null}
    </div>
  );
}

function toneForReviewStatus(value) {
  if (value === "rejected") {
    return "danger";
  }
  if (value === "needs_review") {
    return "warning";
  }
  if (value === "verified") {
    return "success";
  }
  return "default";
}

function toneForItemSignal(value) {
  if (value === "unlinked") {
    return "warning";
  }
  if (value === "verified_links_only") {
    return "success";
  }
  if (value === "mixed_review") {
    return "warning";
  }
  return "default";
}

function formatSignalLabel(value) {
  if (value === "verified_links_only") {
    return "Verified links only";
  }
  if (value === "mixed_review") {
    return "Mixed review";
  }
  if (value === "unlinked") {
    return "Unlinked";
  }

  return value || "Unknown";
}

function GapList({ title, rows, emptyLabel, tone = "default", renderRow }) {
  return (
    <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--admin-text)]">{title}</h3>
        <Badge tone={tone}>{rows.length}</Badge>
      </div>
      <div className="mt-3 rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-3">
        {rows.length ? (
          <ul className="space-y-2 text-[11px] text-[var(--admin-text-soft)]">
            {rows.map((row) => (
              <li key={row.id || `${row.agenda_item_id}:${row.entity_type}:${row.entity_id}`}>
                {renderRow(row)}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[11px] text-[var(--admin-text-soft)]">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function SourceRefKeyList({ refs = [] }) {
  if (!refs.length) {
    return <span className="text-[var(--admin-text-muted)]">No source refs</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {refs.map((ref) => (
        <Badge key={ref.key} mono>
          {ref.key}
        </Badge>
      ))}
    </div>
  );
}

export default async function AdminProject2025AgendaPage() {
  const review = getAgendaReviewData("project-2025");

  if (!review) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
              Agenda Curation
            </p>
            <h1 className="text-lg font-semibold text-[var(--admin-text)]">
              Project 2025 review surface
            </h1>
            <p className="max-w-5xl text-[12px] text-[var(--admin-text-soft)]">
              Read-only inspection of the structured agenda catalog. This page is
              for editorial audit only: agenda items, grounded links, reasoning,
              confidence, review status, and supporting source references.
            </p>
          </div>
          <div className="space-y-1 text-right text-[11px] text-[var(--admin-text-muted)]">
            <div>
              Public tracker:{" "}
              <Link
                href="/agendas/project-2025"
                className="text-[var(--admin-link)] underline"
              >
                /agendas/project-2025
              </Link>
            </div>
            <div>
              Source curation:{" "}
              <Link
                href="/admin/source-curation"
                className="text-[var(--admin-link)] underline"
              >
                /admin/source-curation
              </Link>
            </div>
          </div>
        </div>
        <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 text-[12px] text-[var(--admin-text-soft)] shadow-sm">
          The public tracker continues to use verified links only. This route
          exposes the full local catalog shape for inspection without adding
          editing or mutation behavior.
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Agenda items" value={review.metrics.total_items} />
        <MetricCard label="Verified links" value={review.metrics.verified_links} />
        <MetricCard label="Unlinked items" value={review.metrics.unlinked_items} />
        <MetricCard label="Source refs" value={review.metrics.source_ref_count} />
        <MetricCard
          label="Items missing sources"
          value={review.metrics.items_without_source_refs}
        />
        <MetricCard
          label="Verified-link items"
          value={review.metrics.items_with_only_verified_links}
          note="Items with at least one link and no non-verified links."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <GapList
          title="Items with no links"
          rows={review.gaps.items_without_links}
          emptyLabel="Every agenda item has at least one link."
          tone={review.gaps.items_without_links.length ? "warning" : "success"}
          renderRow={(row) => (
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="font-medium text-[var(--admin-text)]">
                  {row.title}
                </span>
                <span className="text-[var(--admin-text-muted)]">
                  {" "}
                  • {row.policy_domain_label}
                </span>
              </span>
            </div>
          )}
        />
        <GapList
          title="Items with no source refs"
          rows={review.gaps.items_without_source_refs}
          emptyLabel="Every agenda item has at least one source ref."
          tone={review.gaps.items_without_source_refs.length ? "warning" : "success"}
          renderRow={(row) => (
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="font-medium text-[var(--admin-text)]">
                  {row.title}
                </span>
                <span className="text-[var(--admin-text-muted)]">
                  {" "}
                  • {row.policy_domain_label}
                </span>
              </span>
            </div>
          )}
        />
        <GapList
          title="Metadata gaps"
          rows={[
            ...review.gaps.links_missing_reasoning.map((row) => ({
              ...row,
              id: `${row.id}:reasoning`,
              gap_label: "Missing reasoning",
            })),
            ...review.gaps.links_missing_confidence.map((row) => ({
              ...row,
              id: `${row.id}:confidence`,
              gap_label: "Missing confidence",
            })),
            ...review.gaps.links_needing_review.map((row) => ({
              ...row,
              id: `${row.id}:review`,
              gap_label: `Review status: ${row.review_status || "unknown"}`,
            })),
          ]}
          emptyLabel="No missing reasoning, confidence, or review-state gaps."
          tone={
            review.gaps.links_missing_reasoning.length ||
            review.gaps.links_missing_confidence.length ||
            review.gaps.links_needing_review.length
              ? "warning"
              : "success"
          }
          renderRow={(row) => (
            <div>
              <div className="font-medium text-[var(--admin-text)]">
                {row.gap_label}
              </div>
              <div className="mt-1 font-mono text-[10px] text-[var(--admin-text-muted)]">
                {row.agenda_item_id} → {row.entity_type}:{row.entity_id}
              </div>
            </div>
          )}
        />
      </section>

      <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">
              Agenda items
            </h2>
            <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
              Each item shows normalized taxonomy, sourcing, and the current set
              of curated record links.
            </p>
          </div>
          <Badge>{review.items.length} items</Badge>
        </div>
        <div className="mt-3 space-y-3">
          {review.items.map((item) => (
            <article
              key={item.id}
              className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge mono>{item.id}</Badge>
                    <Badge tone={item.status_tone}>{item.status_label}</Badge>
                    <Badge tone={toneForItemSignal(item.item_review_signal)}>
                      {formatSignalLabel(item.item_review_signal)}
                    </Badge>
                    {item.source_ref_count === 0 ? (
                      <Badge tone="warning">No item sources</Badge>
                    ) : null}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-[var(--admin-text)]">
                    {item.title}
                  </h3>
                  <p className="mt-1 max-w-5xl text-[11px] text-[var(--admin-text-soft)]">
                    {item.summary}
                  </p>
                </div>
                <div className="grid min-w-[260px] gap-2 text-[11px] text-[var(--admin-text-soft)] sm:grid-cols-2">
                  <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-2 py-1.5">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                      Domain
                    </div>
                    <div className="mt-1 text-[var(--admin-text)]">
                      {item.policy_domain_label}
                    </div>
                  </div>
                  <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-2 py-1.5">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                      Action type
                    </div>
                    <div className="mt-1 text-[var(--admin-text)]">
                      {item.action_type_label}
                    </div>
                  </div>
                  <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-2 py-1.5">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                      Source refs
                    </div>
                    <div className="mt-1 text-[var(--admin-text)]">
                      {item.source_ref_count}
                    </div>
                  </div>
                  <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-2 py-1.5">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                      Linked records
                    </div>
                    <div className="mt-1 text-[var(--admin-text)]">{item.link_count}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                  Item source refs
                </div>
                <div className="mt-2">
                  <SourceRefKeyList refs={item.source_refs_resolved} />
                </div>
              </div>

              <div className="mt-3 overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)]">
                <table className="min-w-full text-[12px]">
                  <thead className="bg-[var(--admin-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                    <tr>
                      <th className="border-b border-[var(--admin-line)] px-3 py-2">
                        Linked record
                      </th>
                      <th className="border-b border-[var(--admin-line)] px-3 py-2">
                        Relation
                      </th>
                      <th className="border-b border-[var(--admin-line)] px-3 py-2">
                        Confidence
                      </th>
                      <th className="border-b border-[var(--admin-line)] px-3 py-2">
                        Review
                      </th>
                      <th className="border-b border-[var(--admin-line)] px-3 py-2">
                        Reasoning
                      </th>
                      <th className="border-b border-[var(--admin-line)] px-3 py-2">
                        Source refs
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.links.length ? (
                      item.links.map((link) => (
                        <tr
                          key={link.id}
                          className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)]"
                        >
                          <td className="border-b border-[var(--admin-line)] px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <Badge tone="default">{link.entity_type_label}</Badge>
                              <Badge mono>{link.entity_id}</Badge>
                            </div>
                          </td>
                          <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                            {link.relationship_label}
                          </td>
                          <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                            {link.confidence_label}
                          </td>
                          <td className="border-b border-[var(--admin-line)] px-3 py-2">
                            <Badge tone={toneForReviewStatus(link.review_status)}>
                              {link.review_status || "unknown"}
                            </Badge>
                          </td>
                          <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                            {link.reasoning || "No reasoning recorded"}
                          </td>
                          <td className="border-b border-[var(--admin-line)] px-3 py-2">
                            <SourceRefKeyList refs={link.source_refs_resolved} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-4 text-[11px] text-[var(--admin-text-soft)]"
                        >
                          No linked records curated for this agenda item yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">
              Source references
            </h2>
            <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
              Catalog-level source refs available to this agenda slice, plus
              where each ref is currently used.
            </p>
          </div>
          <Badge>{review.source_refs.length} refs</Badge>
        </div>
        <div className="mt-3 overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
          <table className="min-w-full text-[12px]">
            <thead className="bg-[var(--admin-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
              <tr>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">
                  Key
                </th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">
                  Publisher / type
                </th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">
                  Location
                </th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">
                  Usage
                </th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {review.source_refs.map((source) => (
                <tr
                  key={source.key}
                  className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)]"
                >
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <div className="font-mono text-[11px] text-[var(--admin-text)]">
                      {source.key}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
                      {source.title}
                    </div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    <div>{source.publisher || "Unknown publisher"}</div>
                    <div className="mt-1">
                      <Badge>{source.source_type || "unknown"}</Badge>
                    </div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    {source.source_url ? (
                      <a
                        href={source.source_url}
                        className="break-all text-[var(--admin-link)] underline"
                      >
                        {source.source_url}
                      </a>
                    ) : source.artifact_path ? (
                      <span className="break-all font-mono text-[10px] text-[var(--admin-text-muted)]">
                        {source.artifact_path}
                      </span>
                    ) : (
                      "No source location recorded"
                    )}
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    <div>agenda: {source.agenda_ref_count}</div>
                    <div>items: {source.item_ref_count}</div>
                    <div>links: {source.link_ref_count}</div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    {source.note || "No editorial note recorded"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
