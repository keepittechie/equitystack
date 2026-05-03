import Link from "next/link";

export function priorityClasses(priority) {
  switch (priority) {
    case "Critical":
      return "status-pill--danger";
    case "High":
      return "status-pill--warning";
    case "Medium":
      return "status-pill--warning";
    case "Low":
      return "status-pill--default";
    default:
      return "status-pill--default";
  }
}

export function statusClasses(status) {
  switch (status) {
    case "Introduced":
      return "status-pill--info";
    case "Advocacy":
      return "status-pill--violet";
    case "Drafting":
      return "status-pill--success";
    case "Idea":
      return "status-pill--default";
    default:
      return "status-pill--default";
  }
}

export function trackedBillStatusClasses(status) {
  switch (status) {
    case "Introduced":
      return "status-pill--info";
    case "Passed House":
      return "status-pill--info";
    case "Passed Senate":
      return "status-pill--violet";
    case "Enacted":
      return "status-pill--success";
    case "Failed":
    case "Stalled":
      return "status-pill--danger";
    default:
      return "status-pill--default";
  }
}

export function formatDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getMostRecentAction(trackedBills) {
  const datedActions = trackedBills
    .flatMap((trackedBill) =>
      (trackedBill.actions || []).map((action) => ({
        ...action,
        bill_number: trackedBill.bill_number,
        tracked_bill_title: trackedBill.title,
      }))
    )
    .filter((action) => action.date);

  if (!datedActions.length) return null;

  return datedActions.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
}

export function SponsorLine({ sponsor }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-white/8 bg-[rgba(8,14,24,0.92)] px-3 py-2">
      <div>
        <p className="font-medium">{sponsor.name}</p>
        <p className="text-xs text-[var(--ink-soft)] mt-1">
          {[sponsor.role, sponsor.party, sponsor.state].filter(Boolean).join(" • ")}
        </p>
      </div>
    </div>
  );
}

export function LegislatorLine({ legislator }) {
  return (
    <Link
      href={`/scorecards/${legislator.id}`}
      className="panel-link flex items-center justify-between gap-3 flex-wrap rounded-xl border border-white/8 bg-[rgba(8,14,24,0.92)] px-3 py-2"
    >
      <div>
        <p className="font-medium">{legislator.full_name}</p>
        <p className="text-xs text-[var(--ink-soft)] mt-1">
          {[legislator.role, legislator.chamber, legislator.party, legislator.state]
            .filter(Boolean)
            .join(" • ")}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Net Impact</p>
        <p className="text-sm font-semibold">
          {Number(legislator.net_weighted_impact || 0).toFixed(2)}
        </p>
      </div>
    </Link>
  );
}

export function ActionLine({ action }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[rgba(8,14,24,0.92)] px-3 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
          {action.type || "Action"}
        </p>
        <p className="text-xs text-[var(--ink-soft)]">
          {formatDate(action.date) || "Date unavailable"}
        </p>
      </div>
      <p className="text-sm text-[var(--ink-soft)] mt-2 leading-6">{action.text}</p>
      {(action.chamber || action.committee_name) && (
        <p className="text-xs text-[var(--ink-soft)] mt-2">
          {[action.chamber, action.committee_name].filter(Boolean).join(" • ")}
        </p>
      )}
      {action.source_url ? (
        <a
          href={action.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-xs accent-link hover:underline"
        >
          View action source
        </a>
      ) : null}
    </div>
  );
}

function SourceLine({ source }) {
  return (
    <div className="card-muted rounded-[1.2rem] p-4">
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold accent-link"
        >
          {source.title}
        </a>
      ) : (
        <p className="font-semibold">{source.title}</p>
      )}
      <p className="text-sm text-[var(--ink-soft)] mt-2">
        {[source.publisher, source.type, formatDate(source.date)].filter(Boolean).join(" • ")}
      </p>
      {source.notes ? <p className="text-sm text-[var(--ink-soft)] mt-2">{source.notes}</p> : null}
    </div>
  );
}

export function FutureBillDetailSections({ bill, detailMode = false, sources = [] }) {
  return (
    <>
      <div className="grid gap-4 mt-6 lg:grid-cols-2">
        <div className="card-muted rounded-[1.25rem] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)] mb-2">
            Problem Statement
          </h3>
          <p className="text-[var(--ink-soft)] leading-7">{bill.problem_statement}</p>
        </div>

        <div className="card-muted rounded-[1.25rem] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)] mb-2">
            Proposed Solution
          </h3>
          <p className="text-[var(--ink-soft)] leading-7">{bill.proposed_solution}</p>
        </div>
      </div>

      {detailMode && (
        <section className="card-muted rounded-[1.35rem] p-5 mt-6">
          <h2 className="text-lg font-semibold">How to Verify This Page</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">
            Start with the linked real legislation below, then open the bill sources, action updates,
            sponsor records, and explainers tied to this proposal.
          </p>
        </section>
      )}

      <div className="mt-6 border-t pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)] mb-3">
          Real Legislation
        </h3>

        {bill.tracked_bills.length > 0 ? (
          <div className="space-y-3">
            {bill.tracked_bills.map((trackedBill) => (
              <div key={trackedBill.id} className="card-muted rounded-[1.25rem] p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="max-w-3xl">
                    <p className="font-semibold">
                      {trackedBill.bill_number} - {trackedBill.title}
                    </p>

                    <div className="mt-2 space-y-1 text-sm text-[var(--ink-soft)]">
                      {(trackedBill.jurisdiction || trackedBill.chamber || trackedBill.session_label) && (
                        <p>
                          <span className="font-medium text-[var(--foreground)]">Context:</span>{" "}
                          {[trackedBill.jurisdiction, trackedBill.chamber, trackedBill.session_label]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      )}

                      {trackedBill.introduced_date && (
                        <p>
                          <span className="font-medium text-[var(--foreground)]">Introduced:</span>{" "}
                          {formatDate(trackedBill.introduced_date)}
                        </p>
                      )}

                      {trackedBill.sponsor && (
                        <p>
                          <span className="font-medium text-[var(--foreground)]">Sponsor:</span>{" "}
                          {trackedBill.sponsor}
                        </p>
                      )}

                      {trackedBill.latest_action && (
                        <p>
                          <span className="font-medium text-[var(--foreground)]">Latest Action:</span>{" "}
                          {trackedBill.latest_action}
                        </p>
                      )}

                      {trackedBill.date && (
                        <p>
                          <span className="font-medium text-[var(--foreground)]">Action Date:</span>{" "}
                          {formatDate(trackedBill.date)}
                        </p>
                      )}

                      {trackedBill.source_system && (
                        <p>
                          <span className="font-medium text-[var(--foreground)]">Source:</span>{" "}
                          {trackedBill.source_system}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="public-pill">
                      {trackedBill.latest_update_label}
                    </span>

                    <span className="public-pill">
                      Sponsors: {trackedBill.sponsor_count}
                    </span>

                    <span className="public-pill">
                      Scorecards: {trackedBill.legislator_count || 0}
                    </span>

                    <span className="public-pill">
                      Actions: {trackedBill.action_count}
                    </span>

                    {trackedBill.link_type && (
                      <span className="status-pill status-pill--warning">
                        {trackedBill.link_type} Match
                      </span>
                    )}

                    <span
                      className={`status-pill ${trackedBillStatusClasses(
                        trackedBill.status
                      )}`}
                    >
                      {trackedBill.status || "Unknown"}
                    </span>
                  </div>
                </div>

                {trackedBill.official_summary && (
                  <p className="mt-3 text-sm text-[var(--ink-soft)] leading-7">
                    {trackedBill.official_summary}
                  </p>
                )}

                {trackedBill.link_notes && (
                  <p className="mt-2 text-xs text-[var(--ink-soft)]">{trackedBill.link_notes}</p>
                )}

                {trackedBill.sponsors?.length > 0 && (
                  <details className="mt-4" open={detailMode && trackedBill.sponsors.length <= 3}>
                    <summary className="cursor-pointer text-sm font-medium accent-link">
                      View sponsors
                    </summary>
                    <div className="mt-3 space-y-2">
                      {trackedBill.sponsors.map((sponsor) => (
                        <SponsorLine
                          key={sponsor.id || `${trackedBill.id}-${sponsor.name}`}
                          sponsor={sponsor}
                        />
                      ))}
                    </div>
                  </details>
                )}

                {trackedBill.linked_legislators?.length > 0 && (
                  <details className="mt-4" open={detailMode && trackedBill.linked_legislators.length <= 3}>
                    <summary className="cursor-pointer text-sm font-medium accent-link">
                      View linked legislator scorecards
                    </summary>
                    <div className="mt-3 space-y-2">
                      {trackedBill.linked_legislators.map((legislator) => (
                        <LegislatorLine
                          key={`${trackedBill.id}-${legislator.id}-${legislator.role}`}
                          legislator={legislator}
                        />
                      ))}
                    </div>
                  </details>
                )}

                {trackedBill.actions?.length > 0 && (
                  <details className="mt-4" open={detailMode || trackedBill.actions.length <= 2}>
                    <summary className="cursor-pointer text-sm font-medium accent-link">
                      View action timeline
                    </summary>
                    <div className="mt-3 space-y-2">
                      {trackedBill.actions.map((action) => (
                        <ActionLine
                          key={action.id || `${trackedBill.id}-${action.date}-${action.text}`}
                          action={action}
                        />
                      ))}
                    </div>
                  </details>
                )}

                {trackedBill.url && (
                  <div className="mt-3">
                    <a
                      href={trackedBill.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium accent-link"
                    >
                      View bill source
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-soft)]">No real legislation linked yet.</p>
        )}
      </div>

      {bill.related_explainers?.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)] mb-3">
            Used in Explainers
          </h3>

          <div className="space-y-3">
            {bill.related_explainers.map((explainer) => (
              <Link
                key={explainer.id}
                href={`/explainers/${explainer.slug}`}
                className="panel-link block rounded-[1.25rem] p-4"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="font-semibold">{explainer.title}</h4>

                  {explainer.category && (
                    <span className="public-pill">
                      {explainer.category}
                    </span>
                  )}
                </div>

                {explainer.summary && (
                  <p className="mt-2 text-sm text-[var(--ink-soft)] line-clamp-3">
                    {explainer.summary}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {bill.linked_legislators?.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)] mb-3">
            Linked Legislator Scorecards
          </h3>

          <div className="grid gap-3 md:grid-cols-2">
            {bill.linked_legislators.slice(0, detailMode ? undefined : 4).map((legislator) => (
              <LegislatorLine
                key={`future-bill-${bill.id}-legislator-${legislator.id}`}
                legislator={legislator}
              />
            ))}
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)] mb-3">
            Sources
          </h3>

          <div className="space-y-3">
            {sources.map((source) => (
              <SourceLine
                key={`${source.title}-${source.url || source.publisher || ""}`}
                source={source}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
