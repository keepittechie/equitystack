import Link from "next/link";
import { getAdminCommandCenterData } from "@/lib/services/adminCommandCenterService";

function HealthBadge({ status }) {
  const classes =
    status === "pass"
      ? "border-green-300 bg-green-100 text-green-900"
      : "border-amber-300 bg-amber-100 text-amber-900";

  return <span className={`rounded-full border px-2 py-0.5 text-xs ${classes}`}>{status}</span>;
}

export const dynamic = "force-dynamic";

export default async function AdminRunbookPage() {
  const commandCenter = await getAdminCommandCenterData();
  const healthChecks = commandCenter.operational_health?.checks || [];

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <section className="space-y-3">
        <p className="text-sm text-gray-600">Operator Runbook</p>
        <h1 className="text-3xl font-bold">How to Use This System</h1>
        <p className="text-gray-700 max-w-4xl">
          This page is the daily operating guide for EquityStack. The CLI remains canonical,
          the dashboard is for understanding and navigation, the Operator Console is supervised
          and registry-driven, and recommendations are guidance only. Nothing here auto-approves,
          auto-imports, or bypasses existing guardrails.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">What Each Surface Is For</h2>
          <div className="mt-4 space-y-4 text-sm text-gray-700">
            <div>
              <p className="font-semibold">Dashboard / Command Center</p>
              <p className="mt-1">
                Start here first. Use it to understand workflow state, see what is blocked or ready,
                review attention items and recommendations, and decide which page should be opened next.
                The dashboard is for reading and navigation, not for running commands directly.
              </p>
            </div>
            <div>
              <p className="font-semibold">Operator Console</p>
              <p className="mt-1">
                Use this when you intentionally want to run an approved registry-backed action after
                checking the dashboard. It can summarize state, inspect readiness, and run safe
                supervised discovery, status, pre-commit, or dry-run commands through the existing wrapped backend/CLI path.
              </p>
            </div>
            <div>
              <p className="font-semibold">What the Operator Console can do</p>
              <p className="mt-1">
                Run safe status/discovery/pre-commit or dry-run actions that are already exposed in
                the registry and respect readiness checks.
              </p>
            </div>
            <div>
              <p className="font-semibold">What it cannot do</p>
              <p className="mt-1">
                It cannot approve records, finalize decisions, import independently, or invent new
                commands outside the registry.
              </p>
            </div>
          </div>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">Operational Health Check</h2>
          <div className="mt-4 space-y-3 text-sm">
            {healthChecks.map((check) => (
              <div key={check.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">{check.label}</p>
                  <HealthBadge status={check.status} />
                </div>
                <p className="mt-2 text-gray-700">{check.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">Daily Checklist</h2>
          <ul className="mt-4 list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>Review dashboard attention items and smart recommendations first.</li>
            <li>Inspect repeated blocked or failed actions in Operator Insights.</li>
            <li>Run a safe status summary from the Operator Console if the system appears stuck.</li>
            <li>Move to current-admin or legislative approval pages when pending work exists.</li>
            <li>Only run dry-run or review-oriented actions after checking readiness and blockers.</li>
          </ul>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">Weekly Checklist</h2>
          <ul className="mt-4 list-disc pl-5 space-y-2 text-sm text-gray-700">
            <li>Review operator insights for the most blocked and most failed actions.</li>
            <li>Inspect recurring friction signals and determine whether guidance needs improvement.</li>
            <li>Review dismissed or not-helpful recommendations for quality tuning opportunities.</li>
            <li>Check whether the same workflows are repeatedly waiting on missing approvals or artifacts.</li>
            <li>Confirm the command center still reflects meaningful state across both workflows.</li>
          </ul>
        </div>
      </section>

      <section className="border rounded-2xl p-5 bg-white shadow-sm">
        <h2 className="text-xl font-semibold">Fresh Walkthrough Reset</h2>
        <div className="mt-4 space-y-3 text-sm text-gray-700">
          <p>
            Before a fresh demo or walkthrough, you can archive old operational artifacts so the
            dashboard, recommendations, operator history, and pipeline reports start from a clean baseline.
          </p>
          <p>
            The safe reset command is:
            <code className="ml-2 rounded bg-gray-100 px-2 py-1">./bin/equitystack admin-reset-operational-state --dry-run</code>
          </p>
          <p>
            To apply it after reviewing the dry-run output:
            <code className="ml-2 rounded bg-gray-100 px-2 py-1">./bin/equitystack admin-reset-operational-state --apply --yes</code>
          </p>
          <p>
            This archives operational run-state only. It does not remove canonical policy data, database content,
            or source files.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">How to Respond</h2>
          <div className="mt-4 space-y-4 text-sm text-gray-700">
            <div>
              <p className="font-semibold">Blocked actions</p>
              <p className="mt-1">
                Do not keep retrying. Open the suggested next step, inspect readiness, and resolve
                the prerequisite first.
              </p>
            </div>
            <div>
              <p className="font-semibold">Failed actions</p>
              <p className="mt-1">
                Review the latest logs or related artifacts before retrying. Failures usually need
                diagnosis, not a faster retry loop.
              </p>
            </div>
            <div>
              <p className="font-semibold">Pending approvals</p>
              <p className="mt-1">
                Move to the appropriate review surface and finish operator decisions before trying
                downstream actions.
              </p>
            </div>
            <div>
              <p className="font-semibold">Import-ready states</p>
              <p className="mt-1">
                Treat them as a prompt for supervised review. Import-ready does not remove manual
                approval, dry-run, or other existing checks.
              </p>
            </div>
            <div>
              <p className="font-semibold">Repeated friction signals</p>
              <p className="mt-1">
                Use them as investigation prompts. Repeated friction is a sign that guidance,
                readiness, or diagnostics need closer attention.
              </p>
            </div>
          </div>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">Quick Links</h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/admin" className="rounded-lg border px-4 py-2">
              Open Command Center
            </Link>
            <Link href="/admin/operator-console" className="rounded-lg border px-4 py-2">
              Open Operator Console
            </Link>
            <Link href="/admin/current-admin-review" className="rounded-lg border px-4 py-2">
              Current-Admin Review
            </Link>
            <Link href="/admin/legislative-workflow" className="rounded-lg border px-4 py-2">
              Legislative Workflow
            </Link>
            <Link href="/admin/pre-commit" className="rounded-lg border px-4 py-2">
              Pre-Commit Status
            </Link>
            <Link href="/admin/logs" className="rounded-lg border px-4 py-2">
              Logs / Decisions
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
