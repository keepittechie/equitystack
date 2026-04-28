import Link from "next/link";
import { listReviewQueueItems } from "@/lib/server/admin-operator/workflowData.js";
import { getReviewQueueActionDescriptors } from "@/lib/server/admin-operator/operatorActionDescriptors.js";
import OperatorPageAutoRefresh from "@/app/admin/components/OperatorPageAutoRefresh";
import CompactActionSelect from "@/app/admin/components/CompactActionSelect";

function toWorkflowLabel(value) {
  if (value === "current-admin") {
    return "Current Admin";
  }
  if (value === "legislative") {
    return "Legislative";
  }
  return value || "Unknown";
}

function queueTypeLabel(item) {
  if (item.workflowFamily === "legislative" && item.queueType === "manual-review") {
    return "Legislative Manual Review";
  }
  if (item.workflowFamily === "legislative" && item.queueType === "bundle-approval") {
    return "Bundle Approval";
  }
  if (item.workflowFamily === "current-admin" && item.queueType === "operator-review") {
    return "Current-Admin Manual Review";
  }
  if (item.workflowFamily === "current-admin" && item.queueType === "apply-readiness") {
    return item.state === "ready_for_apply_confirmation"
      ? "Import Approval Follow-Up"
      : "Pre-commit / Apply Readiness";
  }
  return item.queueType || "Review";
}

function primaryDetailLabel(item) {
  if (item.workflowFamily === "current-admin") {
    return "Open current-admin review";
  }
  if (item.workflowFamily === "legislative" && item.queueType === "manual-review") {
    return "Open legislative manual review";
  }
  if (item.workflowFamily === "legislative") {
    return "Open legislative review";
  }
  return "Open workflow";
}

export default async function AdminReviewQueuePage() {
  const items = await listReviewQueueItems();

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <OperatorPageAutoRefresh />

      <section className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Review Queue</p>
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Pending human review work</h2>
        <p className="max-w-5xl text-[12px] text-[var(--admin-text-soft)]">
          This page only lists the remaining human checkpoints. AI-approved apply-ready work stays on
          the canonical workflow surfaces, while deeper inspection still lives on the review surfaces
          and session inspector.
        </p>
      </section>

      <section className="overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
        <table className="min-w-[1320px] w-full text-[11px]">
          <thead className="bg-[var(--admin-surface-muted)] text-left uppercase tracking-wide text-[var(--admin-text-muted)]">
            <tr>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Workflow</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Queue Type</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Record</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Key Facts</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Reason</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Risk</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Decision</th>
              <th className="border-b border-[var(--admin-line)] px-2 py-1">Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const actions = getReviewQueueActionDescriptors(item);

              return (
                <tr key={item.id} className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)] hover:bg-[var(--admin-surface-soft)]">
                  <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">{toWorkflowLabel(item.workflowFamily)}</td>
                  <td className="border-b border-[var(--admin-line)] px-2 py-1">
                    <div className="font-medium text-[var(--admin-text)]">{queueTypeLabel(item)}</div>
                    <div className="font-mono text-[10px] text-[var(--admin-text-muted)]">{item.id}</div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-2 py-1">
                    <div className="font-medium text-[var(--admin-text)]">{item.title}</div>
                    <div className="mt-0.5 max-w-[220px] truncate text-[var(--admin-text-soft)]" title={item.detail}>
                      {item.detail}
                    </div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">
                    <div className="max-w-[220px] truncate" title={item.explanation?.expectedAction || ""}>
                      expected: {item.explanation?.expectedAction || "inspect canonical workflow"}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-[var(--admin-text-muted)]">
                      session: {item.sessionId}
                    </div>
                    <div className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-[var(--admin-text-muted)]" title={item.artifactPath || ""}>
                      {item.artifactPath || "no artifact path"}
                    </div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-2 py-1">
                    <div className="max-w-[260px] truncate text-[var(--admin-text-soft)]" title={item.explanation?.whyExists || item.detail}>
                      {item.explanation?.whyExists || item.detail}
                    </div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-2 py-1">
                    <span className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--admin-text-soft)]">
                      {item.riskLevel || "medium"}
                    </span>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-2 py-1">
                    <CompactActionSelect actions={actions} />
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-2 py-1">
                    <div className="flex flex-wrap gap-2">
                      <Link href={item.href} className="text-[11px] text-[var(--admin-link)] underline">
                        {primaryDetailLabel(item)}
                      </Link>
                      <Link href={`/admin/workflows/${encodeURIComponent(item.sessionId)}`} className="text-[11px] text-[var(--admin-link)] underline">
                        Open session inspector
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={8} className="px-2 py-3 text-[11px] text-[var(--admin-text-muted)]">
                  <div>No review items pending.</div>
                  <div className="mt-1">
                    Next step: run the current-admin or legislative workflow again if you expected new review work.
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Link href="/admin/workflows" className="text-[var(--admin-link)] underline">
                      Open workflows
                    </Link>
                    <Link href="/admin" className="text-[var(--admin-link)] underline">
                      Open command center
                    </Link>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
