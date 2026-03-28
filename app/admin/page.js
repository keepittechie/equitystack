import Link from "next/link";
import {
  getCurrentAdministrationDecisionMetrics,
  getCurrentAdministrationOperatorWorkspace,
  getCurrentAdministrationWorkflowGuide,
} from "@/lib/services/currentAdministrationReviewInsightsService";

export default async function AdminPage() {
  const [workspace, workflowGuide, decisionMetrics] = await Promise.all([
    getCurrentAdministrationOperatorWorkspace(),
    getCurrentAdministrationWorkflowGuide(),
    getCurrentAdministrationDecisionMetrics(),
  ]);
  const batch = workspace.batch;
  const counts = workspace.counts;
  const latestPrecommit = workspace.latest_pre_commit_review;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <section className="space-y-4">
        <p className="text-sm text-gray-600">Admin dashboard</p>
        <h1 className="text-3xl font-bold">Current-admin workflow overview</h1>
        <p className="text-gray-700 max-w-3xl">
          This dashboard is a visual layer on top of the canonical Python
          current-admin workflow. It shows the current batch, the next recommended
          CLI step, and the latest read-only readiness state. It does not generate
          AI reviews or replace the Python import path.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Current batch</p>
          <p className="text-2xl font-semibold mt-2">
            {batch?.batch_name || "Unavailable"}
          </p>
          <p className="text-sm text-gray-700 mt-2">
            Stage: {batch?.stage || "review"}
          </p>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Total items</p>
          <p className="text-2xl font-semibold mt-2">
            {counts.total_items}
          </p>
          <p className="text-sm text-gray-700 mt-2">
            Reviewed items in the current batch workspace.
          </p>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Approved / pending</p>
          <p className="text-2xl font-semibold mt-2">
            {counts.approved} / {counts.pending}
          </p>
          <p className="text-sm text-gray-700 mt-2">
            Items with explicit approval decisions vs items still waiting on the operator.
          </p>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Pre-commit readiness</p>
          <p className="text-2xl font-semibold mt-2">
            {latestPrecommit?.readiness_status || "missing"}
          </p>
          <p className="text-sm text-gray-700 mt-2">
            Last updated: {batch?.last_updated || "Unavailable"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
          <div>
            <p className="text-sm text-gray-600">Current-admin workflow</p>
            <h2 className="text-xl font-semibold mt-1">Canonical next step</h2>
          </div>

            <div className="rounded-xl border p-4 bg-gray-50">
              <p className="text-sm text-gray-600">Next step</p>
              <p className="font-semibold mt-1">{workflowGuide.workflow_handoff.next_step_label}</p>
              <p className="text-sm text-gray-600 mt-2">{latestPrecommit?.recommended_next_step || "Follow the recommended CLI command below."}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Recommended CLI commands</p>
            {workflowGuide.workflow_handoff.next_commands.map((command) => (
              <pre
                key={command}
                className="overflow-x-auto rounded-xl border bg-[var(--paper)] px-4 py-3 text-sm"
              >
                <code>{command}</code>
              </pre>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-600">Current batch files</p>
              <p className="font-semibold mt-1">{batch?.batch_name || "Unavailable"}</p>
              <p className="text-sm text-gray-700 mt-2 break-all">
                Review: {batch?.paths?.review || "No review artifact found."}
              </p>
              <p className="text-sm text-gray-700 mt-2 break-all">
                Queue: {batch?.paths?.queue || "No queue artifact found."}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-600">Latest pre-commit artifact</p>
              <p className="font-semibold mt-1">
                {workflowGuide.latest_pre_commit_review?.readiness_status || "Unavailable"}
              </p>
              <p className="text-sm text-gray-700 mt-2">
                {workflowGuide.latest_pre_commit_review?.recommended_next_step ||
                  "Run the Python pre-commit step after decision logging."}
              </p>
              {workflowGuide.latest_pre_commit_review?.blocking_issue_count ? (
                <p className="text-sm text-gray-600 mt-2">
                  Blocking issues: {workflowGuide.latest_pre_commit_review.blocking_issue_count}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin/current-admin-review" className="border rounded-lg px-4 py-2">
              Current Admin Review
            </Link>
            <Link href="/admin/pre-commit" className="border rounded-lg px-4 py-2">
              Pre-Commit Status
            </Link>
            <Link href="/admin/import-history" className="border rounded-lg px-4 py-2">
              Import History
            </Link>
            <Link href="/admin/logs" className="border rounded-lg px-4 py-2">
              Decision Logs
            </Link>
            <Link
              href="/admin/promises/current-administration"
              className="border rounded-lg px-4 py-2"
            >
              Current-Administration Staging
            </Link>
          </div>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
          <div>
            <p className="text-sm text-gray-600">Decision visibility</p>
            <h2 className="text-xl font-semibold mt-1">Recent decision activity</h2>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-600">Matches vs mismatches</p>
            <p className="mt-2 text-sm">
              Match: {decisionMetrics.alignment_counts.match} <br />
              Mismatch: {decisionMetrics.alignment_counts.mismatch}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-600">Recent sessions</p>
            <div className="mt-2 space-y-3 text-sm">
              {(decisionMetrics.recent_sessions || []).slice(0, 3).map((session) => (
                <div key={session.session_id} className="border rounded-lg p-3">
                  <p className="font-semibold">{session.session_id}</p>
                  <p className="text-gray-600">
                    Focus: {session.session_focus || "unspecified"} • Items: {session.item_count}
                  </p>
                </div>
              ))}
              {!(decisionMetrics.recent_sessions || []).length && (
                <p className="text-gray-600">No decision sessions logged yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
