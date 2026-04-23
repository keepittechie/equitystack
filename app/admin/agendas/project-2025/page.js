import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgendaReviewData } from "@/lib/agendas";

export const dynamic = "force-dynamic";

const VIEW_OPTIONS = [
  { value: "all", label: "All items" },
  { value: "needs_work", label: "Needs work" },
  { value: "unlinked", label: "Unlinked" },
  { value: "missing_sources", label: "Missing sources" },
  { value: "verified_links", label: "Verified links" },
];

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

function FilterPill({ href, isActive, children, tone = "default" }) {
  const activePalette =
    tone === "warning"
      ? "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] text-[var(--warning)]"
      : tone === "success"
        ? "border-[var(--admin-success-line)] bg-[var(--admin-success-surface)] text-[var(--success)]"
        : "border-[var(--admin-line-strong)] bg-[var(--admin-surface)] text-[var(--admin-text)]";

  return (
    <Link
      href={href}
      className={`inline-flex min-h-8 items-center rounded-md border px-3 text-[11px] font-medium transition-colors ${
        isActive
          ? activePalette
          : "border-[var(--admin-line)] bg-[var(--admin-surface-muted)] text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface)]"
      }`}
    >
      {children}
    </Link>
  );
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

function ReviewSummaryCard({ title, value, detail, href, tone = "default" }) {
  return (
    <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
            {title}
          </p>
          <div className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">
            {value}
          </div>
          {detail ? (
            <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">{detail}</p>
          ) : null}
        </div>
        <Badge tone={tone}>{title}</Badge>
      </div>
      {href ? (
        <div className="mt-3">
          <Link href={href} className="text-[11px] text-[var(--admin-link)] underline">
            Open filtered view
          </Link>
        </div>
      ) : null}
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

function normalizeParam(value) {
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }

  return String(value || "").trim();
}

function pageHref(searchParams = {}, updates = {}) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    const resolvedValue = Array.isArray(value) ? value[0] : value;

    if (resolvedValue) {
      params.set(key, resolvedValue);
    }
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  });

  const query = params.toString();

  return query ? `/admin/agendas/project-2025?${query}` : "/admin/agendas/project-2025";
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

function hasItemMetadataGap(item) {
  return item.links.some(
    (link) =>
      !String(link.reasoning || "").trim() ||
      !String(link.confidence || "").trim() ||
      !String(link.review_status || "").trim()
  );
}

function itemNeedsWork(item) {
  return (
    item.link_count === 0 ||
    item.source_ref_count === 0 ||
    hasItemMetadataGap(item) ||
    item.links.some((link) => String(link.review_status || "").trim() !== "verified")
  );
}

export default async function AdminProject2025AgendaPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const review = getAgendaReviewData("project-2025");

  if (!review) {
    notFound();
  }

  const currentView = normalizeParam(resolvedSearchParams.view) || "all";
  const currentDomain = normalizeParam(resolvedSearchParams.domain);
  const currentLinkReview = normalizeParam(resolvedSearchParams.link_review);
  const activeView = VIEW_OPTIONS.some((item) => item.value === currentView)
    ? currentView
    : "all";
  const reviewStatusOptions = Object.keys(review.metrics.review_status_counts || {}).sort();
  const filteredItems = review.items
    .filter((item) => {
      if (activeView === "unlinked" && item.link_count > 0) {
        return false;
      }

      if (activeView === "missing_sources" && item.source_ref_count > 0) {
        return false;
      }

      if (activeView === "verified_links" && !item.has_only_verified_links) {
        return false;
      }

      if (activeView === "needs_work" && !itemNeedsWork(item)) {
        return false;
      }

      if (currentDomain && item.policy_domain !== currentDomain) {
        return false;
      }

      if (
        currentLinkReview &&
        !item.links.some((link) => String(link.review_status || "").trim() === currentLinkReview)
      ) {
        return false;
      }

      return true;
    })
    .map((item) => ({
      ...item,
      visible_links: currentLinkReview
        ? item.links.filter(
            (link) => String(link.review_status || "").trim() === currentLinkReview
          )
        : item.links,
    }));

  const activeFilters = [
    activeView !== "all"
      ? {
          key: "view",
          label: "View",
          value:
            VIEW_OPTIONS.find((option) => option.value === activeView)?.label || activeView,
        }
      : null,
    currentDomain
      ? {
          key: "domain",
          label: "Domain",
          value:
            review.domain_coverage.find((item) => item.domain === currentDomain)?.domain_label ||
            currentDomain,
        }
      : null,
    currentLinkReview
      ? {
          key: "link_review",
          label: "Link review",
          value: currentLinkReview,
        }
      : null,
  ].filter(Boolean);
  const metadataGapRows = [
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
    ...review.gaps.links_missing_review_status.map((row) => ({
      ...row,
      id: `${row.id}:review-status`,
      gap_label: "Missing review status",
    })),
    ...review.gaps.links_needing_review.map((row) => ({
      ...row,
      id: `${row.id}:review`,
      gap_label: `Review status: ${row.review_status || "unknown"}`,
    })),
  ];

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
            <div>
              Exports:{" "}
              <Link
                href="/api/admin/agendas/project-2025?scope=full&download=1"
                className="text-[var(--admin-link)] underline"
              >
                full JSON
              </Link>
              {" • "}
              <Link
                href="/api/admin/agendas/project-2025?scope=summary&download=1"
                className="text-[var(--admin-link)] underline"
              >
                summary JSON
              </Link>
              {" • "}
              <Link
                href="/api/admin/agendas/project-2025?scope=gaps&download=1"
                className="text-[var(--admin-link)] underline"
              >
                gaps JSON
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

      <section className="grid gap-4 xl:grid-cols-4">
        <ReviewSummaryCard
          title="Unlinked items"
          value={review.metrics.unlinked_items}
          detail="Agenda items with no curated record links yet."
          href={pageHref(resolvedSearchParams, { view: "unlinked", domain: "", link_review: "" })}
          tone={review.metrics.unlinked_items ? "warning" : "success"}
        />
        <ReviewSummaryCard
          title="Missing sources"
          value={review.metrics.items_without_source_refs}
          detail="Items that still need at least one supporting source ref."
          href={pageHref(resolvedSearchParams, {
            view: "missing_sources",
            domain: "",
            link_review: "",
          })}
          tone={review.metrics.items_without_source_refs ? "warning" : "success"}
        />
        <ReviewSummaryCard
          title="Links missing metadata"
          value={review.metrics.links_missing_metadata}
          detail="Links missing reasoning, confidence, or review-state metadata."
          href={pageHref(resolvedSearchParams, {
            view: "needs_work",
            domain: "",
            link_review: "",
          })}
          tone={review.metrics.links_missing_metadata ? "warning" : "success"}
        />
        <ReviewSummaryCard
          title="Domains with zero verified linkage"
          value={review.metrics.domains_without_verified_linkage}
          detail="Domains where no agenda item currently has a verified linked record."
          href={pageHref(resolvedSearchParams, { view: "needs_work", link_review: "", domain: "" })}
          tone={review.metrics.domains_without_verified_linkage ? "warning" : "success"}
        />
      </section>

      <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">
              Review filters
            </h2>
            <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
              Query-param filters keep this page read-only while making the item audit
              faster to scan.
            </p>
          </div>
          <Link
            href="/admin/agendas/project-2025"
            className="text-[11px] text-[var(--admin-link)] underline"
          >
            Clear all filters
          </Link>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
              Item view
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {VIEW_OPTIONS.map((option) => (
                <FilterPill
                  key={option.value}
                  href={pageHref(resolvedSearchParams, {
                    view: option.value === "all" ? "" : option.value,
                    link_review: option.value === "unlinked" ? "" : currentLinkReview,
                  })}
                  isActive={activeView === option.value}
                  tone={option.value === "needs_work" ? "warning" : "default"}
                >
                  {option.label}
                </FilterPill>
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
              Domain
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterPill
                href={pageHref(resolvedSearchParams, { domain: "" })}
                isActive={!currentDomain}
              >
                All domains
              </FilterPill>
              {review.domain_coverage.map((domain) => (
                <FilterPill
                  key={domain.domain}
                  href={pageHref(resolvedSearchParams, { domain: domain.domain })}
                  isActive={currentDomain === domain.domain}
                  tone={domain.zero_verified_linkage ? "warning" : "default"}
                >
                  {domain.domain_label}
                </FilterPill>
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
              Link review status
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterPill
                href={pageHref(resolvedSearchParams, { link_review: "" })}
                isActive={!currentLinkReview}
              >
                All links
              </FilterPill>
              {reviewStatusOptions.map((status) => (
                <FilterPill
                  key={status}
                  href={pageHref(resolvedSearchParams, { link_review: status })}
                  isActive={currentLinkReview === status}
                  tone={status === "verified" ? "success" : "warning"}
                >
                  {status} ({review.metrics.review_status_counts[status]})
                </FilterPill>
              ))}
            </div>
          </div>

          {activeFilters.length ? (
            <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
              <span className="font-mono uppercase tracking-wide text-[var(--admin-text-muted)]">
                Active filters
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <Badge key={filter.key} tone="info">
                    {filter.label}: {filter.value}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">
              Domain coverage
            </h2>
            <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
              Compact coverage view for where verified linkage is concentrated and
              where curation remains thin.
            </p>
          </div>
          <Badge>{review.domain_coverage.length} domains</Badge>
        </div>

        <div className="mt-3 overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
          <table className="min-w-full text-[12px]">
            <thead className="bg-[var(--admin-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
              <tr>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Domain</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Items</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Verified links</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Unlinked items</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Missing sources</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Focus</th>
              </tr>
            </thead>
            <tbody>
              {review.domain_coverage.map((domain) => (
                <tr
                  key={domain.domain}
                  className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)]"
                >
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <div className="font-medium text-[var(--admin-text)]">
                      {domain.domain_label}
                    </div>
                    {domain.zero_verified_linkage ? (
                      <div className="mt-1">
                        <Badge tone="warning">No verified linkage yet</Badge>
                      </div>
                    ) : null}
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    {domain.item_count}
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    {domain.verified_link_count}
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    {domain.unlinked_item_count}
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    {domain.items_without_source_refs_count}
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    <Link
                      href={pageHref(resolvedSearchParams, { domain: domain.domain })}
                      className="text-[var(--admin-link)] underline"
                    >
                      Filter items
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          rows={metadataGapRows}
          emptyLabel="No missing reasoning, confidence, or review-state gaps."
          tone={metadataGapRows.length ? "warning" : "success"}
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
              Showing {filteredItems.length} of {review.items.length} items with the
              current filters applied.
            </p>
          </div>
          <Badge>{filteredItems.length} visible</Badge>
        </div>

        <div className="mt-3 space-y-3">
          {filteredItems.length ? (
            filteredItems.map((item) => (
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
                        Visible links
                      </div>
                      <div className="mt-1 text-[var(--admin-text)]">
                        {item.visible_links.length}
                      </div>
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
                      {item.visible_links.length ? (
                        item.visible_links.map((link) => (
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
                            No linked records match the current filters for this agenda item.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-4 py-6 text-[12px] text-[var(--admin-text-soft)]">
              No agenda items match the current filters.
            </div>
          )}
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
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Key</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Publisher / type</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Location</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Usage</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Note</th>
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
