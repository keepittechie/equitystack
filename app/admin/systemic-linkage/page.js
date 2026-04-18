import Link from "next/link";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";
import { getSystemicLinkageOperatorReport } from "@/lib/server/admin-operator/systemicLinkageReport.js";

export const dynamic = "force-dynamic";

function toneForStatus(status) {
  if (status === "manual_review" || status === "partial") {
    return "warning";
  }
  if (status === "inactive" || status === "blocked") {
    return "danger";
  }
  if (status === "active") {
    return "success";
  }
  return "default";
}

function Badge({ children, tone = "default" }) {
  const palette =
    tone === "danger"
      ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] text-[var(--danger)]"
      : tone === "warning"
        ? "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] text-[var(--warning)]"
        : tone === "success"
          ? "border-[var(--admin-success-line)] bg-[var(--admin-success-surface)] text-[var(--success)]"
          : "border-[var(--admin-line)] bg-[var(--admin-surface-muted)] text-[var(--admin-text-soft)]";

  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${palette}`}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, note }) {
  return (
    <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
      <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">{label}</p>
      <div className="mt-2 text-2xl font-semibold text-[var(--admin-text)]">{value}</div>
      {note ? <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">{note}</p> : null}
    </div>
  );
}

function CounterList({ items, emptyLabel }) {
  if (!items.length) {
    return <div className="text-[11px] text-[var(--admin-text-soft)]">{emptyLabel}</div>;
  }

  return (
    <ul className="space-y-1 text-[11px] text-[var(--admin-text-soft)]">
      {items.map(([key, value]) => (
        <li key={key} className="flex items-center justify-between gap-3">
          <span>{key}</span>
          <span className="font-mono text-[var(--admin-text)]">{value}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionSampleList({ title, rows = [] }) {
  if (!rows.length) {
    return null;
  }

  return (
    <div className="mt-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">{title}</div>
      <ul className="mt-1 space-y-1 text-[11px] text-[var(--admin-text-soft)]">
        {rows.map((row) => (
          <li key={`${row.promise_action_id}:${row.promise_id}`}>
            action #{row.promise_action_id} on <span className="font-medium text-[var(--admin-text)]">{row.promise_title || row.promise_slug || `promise ${row.promise_id}`}</span>
            {row.action_title ? ` — ${row.action_title}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AdminSystemicLinkagePage() {
  const report = await getSystemicLinkageOperatorReport();
  const inactiveRows = report.rows.filter((row) => !row.active_in_live_scoring);
  const activeRows = report.rows.filter((row) => row.active_in_live_scoring);
  const inactiveReasonEntries = Object.entries(report.summary.inactive_reason_counts || {});
  const recommendedActionEntries = Object.entries(report.summary.recommended_action_counts || {});

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Operator / Reports</p>
            <h2 className="text-lg font-semibold text-[var(--admin-text)]">Systemic linkage coverage</h2>
            <p className="max-w-5xl text-[12px] text-[var(--admin-text-soft)]">
              Read-only operator report for policies with non-default systemic classifications. It shows whether a policy is active
              in live scoring, whether the path is canonical, and the next grounded curation step when it is not.
            </p>
          </div>
          <div className="space-y-1 text-right text-[11px] text-[var(--admin-text-muted)]">
            <div>Generated {formatAdminDateTime(report.generated_at)}</div>
            <div>
              JSON:{" "}
              <Link href="/api/admin/operator/systemic-linkage" className="text-[var(--admin-link)] underline">
                /api/admin/operator/systemic-linkage
              </Link>
            </div>
          </div>
        </div>
        <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 text-[12px] text-[var(--admin-text-soft)] shadow-sm">
          Numeric `policy_outcomes.policy_id = policies.id` overlap is shown only as diagnostic context. It is never treated as a real link in this report.
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Classified policies" value={report.summary.classified_policy_count} />
        <MetricCard label="Active in live scoring" value={report.summary.active_policy_count} />
        <MetricCard label="Inactive backlog" value={report.summary.inactive_policy_count} />
        <MetricCard label="Manual review rows" value={report.summary.manual_review_count} />
        <MetricCard
          label="Partial surface mismatches"
          value={report.summary.partial_surface_count}
          note="One score surface resolves the policy, another does not."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
          <h3 className="text-base font-semibold text-[var(--admin-text)]">Inactive reason counts</h3>
          <div className="mt-3 rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-3">
            <CounterList items={inactiveReasonEntries} emptyLabel="No inactive rows." />
          </div>
        </div>
        <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
          <h3 className="text-base font-semibold text-[var(--admin-text)]">Recommended operator actions</h3>
          <div className="mt-3 rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-3">
            <CounterList items={recommendedActionEntries} emptyLabel="No action backlog." />
          </div>
        </div>
      </section>

      <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--admin-text)]">Inactive or non-canonical rows</h3>
            <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
              These are the rows that need operator judgment, canonical relation cleanup, or a deliberate leave-as-is decision.
            </p>
          </div>
          <Badge tone={inactiveRows.length ? "warning" : "success"}>{inactiveRows.length} rows</Badge>
        </div>
        <div className="mt-3 overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
          <table className="min-w-full text-[12px]">
            <thead className="bg-[var(--admin-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
              <tr>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Policy</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Systemic metadata</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Scoring path</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Canonical link status</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Reason / next action</th>
              </tr>
            </thead>
            <tbody>
              {inactiveRows.map((row) => (
                <tr key={row.policy_id} className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)]">
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <div className="font-medium text-[var(--admin-text)]">#{row.policy_id} {row.title}</div>
                    <div className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
                      {row.year_enacted || "Year unknown"}{row.policy_type ? ` • ${row.policy_type}` : ""}{row.impact_direction ? ` • ${row.impact_direction}` : ""}
                    </div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <Badge>{row.systemic_impact_category}</Badge>
                    <div className="mt-2 text-[11px] text-[var(--admin-text-soft)]">{row.systemic_impact_summary}</div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={toneForStatus(row.report_status)}>{row.report_status}</Badge>
                      <Badge>{row.scoring_path_type}</Badge>
                    </div>
                    <div className="mt-2">linked_outcome_count: {row.linked_outcome_count}</div>
                    <div>final_report_active_outcomes: {row.final_report_active_outcomes}</div>
                    <div>public_service_active_outcomes: {row.public_service_active_outcomes}</div>
                    <div>judicial_active_outcomes: {row.judicial_active_outcomes}</div>
                    {(row.raw_current_admin_id_overlap || row.raw_legislative_id_overlap) ? (
                      <div className="mt-2 text-[var(--admin-text-muted)]">
                        Ignored numeric overlap: current_admin {row.raw_current_admin_id_overlap} / legislative {row.raw_legislative_id_overlap}
                      </div>
                    ) : null}
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    <Badge>{row.canonical_link_status_label}</Badge>
                    <div className="mt-2">explicit_action_link_count: {row.explicit_action_link_count}</div>
                    <div>exact_title_candidate_action_count: {row.exact_title_candidate_action_count}</div>
                    <ActionSampleList title="Explicit action links" rows={row.explicit_action_samples} />
                    <ActionSampleList title="Exact-title candidates" rows={row.exact_title_candidate_samples} />
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    <div className="font-medium text-[var(--admin-text)]">
                      {row.inactive_reason_label || "No inactive reason"}
                    </div>
                    <div className="mt-1">{row.inactive_reason_detail}</div>
                    <div className="mt-2 rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-2 py-1 text-[var(--admin-text)]">
                      Next action: {row.recommended_operator_action}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--admin-text)]">Already active in live scoring</h3>
            <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
              These policies already reach the live score path. Canonical-link status is still shown so runtime fallback-only rows stay visible.
            </p>
          </div>
          <Badge tone="success">{activeRows.length} rows</Badge>
        </div>
        <div className="mt-3 overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
          <table className="min-w-full text-[12px]">
            <thead className="bg-[var(--admin-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
              <tr>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Policy</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Path</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Canonical link status</th>
                <th className="border-b border-[var(--admin-line)] px-3 py-2">Operator note</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => (
                <tr key={row.policy_id} className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)]">
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <div className="font-medium text-[var(--admin-text)]">#{row.policy_id} {row.title}</div>
                    <div className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
                      {row.year_enacted || "Year unknown"} • {row.systemic_impact_category}
                    </div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="success">{row.report_status}</Badge>
                      <Badge>{row.scoring_path_type}</Badge>
                    </div>
                    <div className="mt-2">linked_outcome_count: {row.linked_outcome_count}</div>
                    <div>final_report_active_outcomes: {row.final_report_active_outcomes}</div>
                    <div>public_service_active_outcomes: {row.public_service_active_outcomes}</div>
                    <div>judicial_active_outcomes: {row.judicial_active_outcomes}</div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    <Badge>{row.canonical_link_status_label}</Badge>
                    <div className="mt-2">explicit_action_link_count: {row.explicit_action_link_count}</div>
                    <div>exact_title_candidate_action_count: {row.exact_title_candidate_action_count}</div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
                    {row.inactive_reason_detail}
                    <div className="mt-2 rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-2 py-1 text-[var(--admin-text)]">
                      Next action: {row.recommended_operator_action}
                    </div>
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
