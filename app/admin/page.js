import Link from "next/link";
import AdminPolicyForm from "./AdminPolicyForm";
import { fetchInternalJson } from "@/lib/api";
import {
  getCurrentAdministrationDecisionMetrics,
  getCurrentAdministrationReviewOverview,
  getCurrentAdministrationWorkflowGuide,
} from "@/lib/services/currentAdministrationReviewInsightsService";

async function getLookups() {
  return fetchInternalJson("/api/admin/lookups", {
    errorMessage: "Failed to fetch admin lookups",
  });
}

export default async function AdminPage() {
  const [lookups, workflowGuide, reviewOverview, decisionMetrics] = await Promise.all([
    getLookups(),
    getCurrentAdministrationWorkflowGuide(),
    getCurrentAdministrationReviewOverview(),
    getCurrentAdministrationDecisionMetrics(),
  ]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <section className="space-y-4">
        <p className="text-sm text-gray-600">Admin review hub</p>
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="text-gray-700 max-w-3xl">
          Use this page as the admin hub for review visibility and workflow guidance.
          Canonical current-admin review generation, decision logging, and pre-commit
          import checks still live in the Python pipeline under <code>python/</code>.
          This page does not generate reviews or trigger imports.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Latest review</p>
          <p className="text-2xl font-semibold mt-2">
            {reviewOverview.review_overview.reviewed_count}
          </p>
          <p className="text-sm text-gray-700 mt-2">
            Items in the latest current-admin review artifact.
          </p>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Decision sessions</p>
          <p className="text-2xl font-semibold mt-2">
            {decisionMetrics.total_decision_log_sessions}
          </p>
          <p className="text-sm text-gray-700 mt-2">
            Logged operator decision sessions currently available.
          </p>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Pre-commit readiness</p>
          <p className="text-2xl font-semibold mt-2">
            {workflowGuide.latest_pre_commit_review?.readiness_status || "missing"}
          </p>
          <p className="text-sm text-gray-700 mt-2">
            Latest import-readiness status from the Python pre-commit artifact.
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
            <p className="text-sm text-gray-600 mt-2">
              Pipeline status key: <span className="font-medium">{workflowGuide.workflow_handoff.next_step}</span>
            </p>
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
              <p className="text-sm text-gray-600">Latest review artifact</p>
              <p className="font-semibold mt-1">
                {workflowGuide.latest_review?.batch_name || "Unavailable"}
              </p>
              <p className="text-sm text-gray-700 mt-2 break-all">
                {workflowGuide.latest_review?.file_path || "No review artifact found."}
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
            <Link href="/admin/review" className="border rounded-lg px-4 py-2">
              Policy Review Queue
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

      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Add Policy Record</h2>
        <p className="text-gray-700 mb-6">
          This editor remains separate from the current-admin Python review pipeline.
        </p>
        <AdminPolicyForm lookups={lookups} />
      </section>
    </main>
  );
}
