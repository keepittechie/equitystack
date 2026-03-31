import Link from "next/link";
import { getAdminCommandCenterData } from "@/lib/services/adminCommandCenterService";
import { formatWorkflowLabel } from "@/lib/operator/operatorActionUtils.js";
import RecommendationList from "./components/RecommendationList";

function stateBannerClasses(tone) {
  if (tone === "attention") {
    return "border-amber-300 bg-amber-50";
  }
  if (tone === "ready") {
    return "border-green-300 bg-green-50";
  }
  return "border-gray-300 bg-gray-50";
}

function stateBadgeClasses(tone) {
  if (tone === "attention") {
    return "border-amber-300 bg-amber-100 text-amber-900";
  }
  if (tone === "ready") {
    return "border-green-300 bg-green-100 text-green-900";
  }
  return "border-gray-300 bg-gray-100 text-gray-900";
}

function WorkflowPanel({ summary, primaryHref, primaryLabel }) {
  return (
    <div className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
      <div>
        <p className="text-sm text-gray-600">{summary.title}</p>
        <h2 className="text-xl font-semibold mt-1">{summary.state}</h2>
        <p className="mt-2 text-sm text-gray-700">{summary.why_this_matters}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-600">Pending approvals</p>
          <p className="text-xl font-semibold mt-1">{summary.pending_review}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-600">Blockers</p>
          <p className="text-xl font-semibold mt-1">{summary.blocked_count}</p>
        </div>
        {"precommit_readiness" in summary ? (
          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-600">Pre-commit readiness</p>
            <p className="text-xl font-semibold mt-1">{summary.precommit_readiness}</p>
          </div>
        ) : (
          <div className="rounded-xl border p-4">
            <p className="text-sm text-gray-600">Apply ready</p>
            <p className="text-xl font-semibold mt-1">{summary.apply_ready ? "yes" : "no"}</p>
          </div>
        )}
        <div className="rounded-xl border p-4">
          <p className="text-sm text-gray-600">Safe next action</p>
          <p className="text-xl font-semibold mt-1">{summary.safe_next_action}</p>
          <p className="mt-2 text-sm text-gray-700">{summary.safe_next_action_reason}</p>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <p className="text-sm text-gray-600">Artifact awareness</p>
        <p className="mt-2 text-sm text-gray-700">{summary.artifact_signal}</p>
        {summary.artifact_path ? (
          <p className="mt-2 break-all text-xs text-gray-600">{summary.artifact_path}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={summary.next_href} className="border rounded-lg px-4 py-2">
          {summary.next_label}
        </Link>
        <Link href={summary.operator_console_href} className="border rounded-lg px-4 py-2">
          Open in Workflow Console
        </Link>
        <Link href={primaryHref} className="border rounded-lg px-4 py-2">
          {primaryLabel}
        </Link>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const commandCenter = await getAdminCommandCenterData();
  const currentAdmin = commandCenter.current_admin_summary;
  const legislative = commandCenter.legislative_summary;
  const indicators = commandCenter.global_indicators;
  const attentionItems = commandCenter.attention_items || [];
  const quickActions = commandCenter.quick_actions || [];
  const operatorInsights = commandCenter.operator_insights || {};
  const potentialFriction = commandCenter.potential_friction || [];
  const smartRecommendations = commandCenter.smart_recommendations || [];
  const whatNow = commandCenter.what_now;

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-8">
      <section className="space-y-4">
        <p className="text-sm text-gray-600">Dashboard / Command Center</p>
        <h1 className="text-3xl font-bold">Admin Command Center</h1>
        <p className="text-gray-700 max-w-4xl">
          This dashboard is the top-level operational view for EquityStack. It derives
          state from the canonical current-admin and legislative artifacts, highlights what
          needs attention, explains why it matters, and points you to the next safe control surface.
        </p>
        <p className="text-sm text-gray-600">
          Need a refresher? Use the{" "}
          <Link href="/admin/runbook" className="underline">
            Operator Runbook
          </Link>{" "}
          for daily guidance and recovery steps.
        </p>
      </section>

      <section className={`border rounded-2xl p-5 shadow-sm ${stateBannerClasses(whatNow?.tone)}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="text-sm text-gray-600">What Should I Do Right Now?</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold">{whatNow?.title || "Review the dashboard"}</h2>
              {whatNow?.scenario_label ? (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${stateBadgeClasses(
                    whatNow.tone
                  )}`}
                >
                  {whatNow.scenario_label}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-gray-700">
              {whatNow?.summary ||
                "The command center will point you to the next safe workflow page as state changes."}
            </p>
            {whatNow?.safety_note ? (
              <p className="mt-3 text-sm text-gray-600">Safety: {whatNow.safety_note}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {whatNow?.next_step_href ? (
              <Link href={whatNow.next_step_href} className="border rounded-lg px-4 py-2 bg-white">
                {whatNow.next_step_label}
              </Link>
            ) : null}
            {whatNow?.operator_console_href ? (
              <Link href={whatNow.operator_console_href} className="border rounded-lg px-4 py-2 bg-white">
                Open in Workflow Console
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Blocked workflows</p>
          <p className="text-2xl font-semibold mt-2">{indicators.blocked_workflows}</p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Approvals pending</p>
          <p className="text-2xl font-semibold mt-2">{indicators.approvals_pending}</p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Imports ready</p>
          <p className="text-2xl font-semibold mt-2">{indicators.imports_ready}</p>
          <p className="mt-2 text-sm text-gray-700">
            Ready means the existing guardrails say a supervised next step is available.
          </p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Validation failures</p>
          <p className="text-2xl font-semibold mt-2">{indicators.validation_failures}</p>
        </div>
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Missing artifacts</p>
          <p className="text-2xl font-semibold mt-2">{indicators.missing_artifacts}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <WorkflowPanel
          summary={currentAdmin}
          primaryHref="/admin/current-admin-review"
          primaryLabel="Open Current-Admin Workflow"
        />
        <WorkflowPanel
          summary={legislative}
          primaryHref="/admin/legislative-workflow"
          primaryLabel="Open Legislative Workflow"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">Operator Insights</h2>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-600">Most used actions</p>
              <div className="mt-3 space-y-2 text-sm">
                {(operatorInsights.most_used_actions || []).length ? (
                  operatorInsights.most_used_actions.map((entry) => (
                    <div key={`used-${entry.action_id}`} className="flex items-center justify-between gap-3">
                      <span>{entry.action_label}</span>
                      <span className="text-gray-600">{entry.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600">No operator actions have been recorded yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-600">Most blocked actions</p>
              <div className="mt-3 space-y-2 text-sm">
                {(operatorInsights.most_blocked_actions || []).length ? (
                  operatorInsights.most_blocked_actions.map((entry) => (
                    <div key={`blocked-${entry.action_id}`} className="flex items-center justify-between gap-3">
                      <span>{entry.action_label}</span>
                      <span className="text-gray-600">{entry.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600">No blocked operator actions appear in recent history.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-600">Recent activity</p>
              <p className="mt-3 text-sm text-gray-700">
                {operatorInsights.recent_activity_summary?.summary ||
                  "No recent operator activity has been recorded yet."}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-600">Most recent failure</p>
              {operatorInsights.most_recent_failure ? (
                <div className="mt-3 text-sm text-gray-700 space-y-1">
                  <p className="font-medium">
                    {operatorInsights.most_recent_failure.action_label ||
                      operatorInsights.most_recent_failure.action_id}
                  </p>
                  <p>{operatorInsights.most_recent_failure.summary}</p>
                  <p className="text-gray-600">{operatorInsights.most_recent_failure.timestamp}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-600">
                  No failed operator actions appear in recent history.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">Potential Friction</h2>
          <div className="mt-4 space-y-3 text-sm">
            {potentialFriction.length ? (
              potentialFriction.map((item, index) => (
                <div key={`${item.type}-${index}`} className="rounded-xl border p-4">
                  <p className="font-semibold">{item.action_label || "Recent friction detected"}</p>
                  <p className="mt-2 text-gray-700">{item.summary}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-gray-700">
                No obvious operator friction is showing in recent history.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <h2 className="text-xl font-semibold">Smart Recommendations</h2>
        <p className="mt-2 text-sm text-gray-600">
          Recommendations are guidance only. They help you choose the next safe step, but they do
          not approve, import, or execute anything by themselves.
        </p>
        <div className="mt-4">
          <RecommendationList
            recommendations={smartRecommendations}
            emptyState="No smart recommendations are active right now. Recent workflow activity looks stable."
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">Needs Attention</h2>
          <div className="mt-4 space-y-3 text-sm">
            {attentionItems.length ? (
              attentionItems.map((item, index) => (
                <div key={`${item.workflow}-${index}`} className="rounded-xl border p-4">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-2 text-gray-700">{item.what_is_wrong}</p>
                  <p className="mt-2 text-gray-600">Why this matters: {item.why_it_matters}</p>
                  <p className="mt-2 text-gray-700">Next: {item.recommended_next_step}</p>
                  {item.artifact_label || item.artifact_path ? (
                    <div className="mt-3 rounded-lg border bg-gray-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Artifact</p>
                      {item.artifact_label ? (
                        <p className="mt-1 font-medium text-gray-900">{item.artifact_label}</p>
                      ) : null}
                      {item.artifact_path ? (
                        <p className="mt-1 break-all text-gray-600">{item.artifact_path}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link href={item.href} className="underline">
                      Open workflow
                    </Link>
                    {item.operator_console_href ? (
                      <Link href={item.operator_console_href} className="underline">
                        Open in Workflow Console
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-gray-700">
                No urgent blockers are recorded right now. The command center is healthy and ready
                for supervised review as new artifacts arrive.
              </div>
            )}
          </div>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">Recommended Next Steps</h2>
          <p className="mt-2 text-sm text-gray-600">
            These links move you into the right review surface. If you need a refresher on the
            daily flow, open the{" "}
            <Link href="/admin/runbook" className="underline">
              Operator Runbook
            </Link>
            .
          </p>
          <div className="mt-4 space-y-3">
            {quickActions.length ? (
              quickActions.map((action) => (
                <div key={`${action.workflow}-${action.href}`} className="rounded-xl border p-4">
                  <p className="font-semibold">{action.label}</p>
                  <p className="mt-2 text-sm text-gray-600">
                    {formatWorkflowLabel(action.workflow)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <Link href={action.href} className="underline">
                      Open workflow page
                    </Link>
                    {action.operator_console_href ? (
                      <Link href={action.operator_console_href} className="underline">
                        Open in Workflow Console
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-gray-700">
                No recommended next steps are queued right now. The dashboard is healthy and ready
                to surface the next safe workflow change.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-600">Supervised control surface</p>
            <h2 className="text-xl font-semibold mt-1">Workflow Console</h2>
            <p className="text-sm text-gray-700 mt-2">
              Run approved wrapped commands, summarize artifacts, and navigate to the right
              workflow page without creating a second execution engine.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              For daily operating guidance, check the{" "}
              <Link href="/admin/runbook" className="underline">
                Operator Runbook
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/admin-approval" className="border rounded-lg px-4 py-2">
              Open Admin Approval
            </Link>
            <Link href="/admin/runbook" className="border rounded-lg px-4 py-2">
              Open Runbook
            </Link>
            <Link href="/admin/operator-console" className="border rounded-lg px-4 py-2">
              Open Workflow Console
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
