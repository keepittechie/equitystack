import { listSerializedOperatorActions } from "@/lib/server/admin-operator/actionRegistry.js";
import { getOperatorVerificationReport } from "@/lib/server/admin-operator/verificationService.js";

export const dynamic = "force-dynamic";

function groupActions(actions) {
  return actions.reduce((bucket, action) => {
    if (!bucket[action.group]) {
      bucket[action.group] = [];
    }
    bucket[action.group].push(action);
    return bucket;
  }, {});
}

function StatusBadge({ status }) {
  return (
    <span className="rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-700">
      {status}
    </span>
  );
}

function VerificationReportCard({ report }) {
  return (
    <section className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">{report.scope}</p>
          <h3 className="mt-1 text-base font-semibold">{report.title}</h3>
          <p className="mt-1 text-[11px] text-gray-500">Checked at {report.checkedAt}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <div className="mt-3 overflow-x-auto rounded border border-zinc-200">
        <table className="min-w-full text-[12px]">
          <thead className="bg-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="border-b border-zinc-200 px-3 py-2">Check</th>
              <th className="border-b border-zinc-200 px-3 py-2">Status</th>
              <th className="border-b border-zinc-200 px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
        {report.checks.map((check) => (
          <tr key={check.id} className="align-top odd:bg-white even:bg-zinc-50/50">
            <td className="border-b border-zinc-200 px-3 py-2">
              <div className="font-medium">{check.name}</div>
              <div className="mt-1 text-[11px] text-zinc-700">{check.summary}</div>
            </td>
            <td className="border-b border-zinc-200 px-3 py-2">
              <StatusBadge status={check.status} />
            </td>
            <td className="border-b border-zinc-200 px-3 py-2 text-[11px] text-zinc-500">
              {check.details ? <div>{check.details}</div> : null}
              {check.recommendedNextStep ? (
                <div className="mt-1">Next step: {check.recommendedNextStep}</div>
              ) : null}
            </td>
          </tr>
        ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function AdminToolsPage() {
  const actions = listSerializedOperatorActions();
  const grouped = groupActions(actions);
  const [environmentReport, remoteExecutorReport, controlPlaneReport] = await Promise.all([
    getOperatorVerificationReport("environment"),
    getOperatorVerificationReport("remote-executor"),
    getOperatorVerificationReport("control-plane"),
  ]);

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">Tools / Registry</p>
        <h2 className="text-lg font-semibold">Verification and registered operator actions</h2>
        <p className="max-w-5xl text-[12px] text-gray-700">
          Verification checks are read-only and never enqueue broker jobs. Use them to confirm production readiness
          on 10.10.0.13, remote executor health against 10.10.0.60, and control-plane configuration before you rely
          on remote mode in the operator surface.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <VerificationReportCard report={environmentReport} />
        <VerificationReportCard report={remoteExecutorReport} />
        <VerificationReportCard report={controlPlaneReport} />
      </section>

      <section className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
        <h3 className="text-base font-semibold">Deterministic verification commands</h3>
        <div className="mt-3 overflow-x-auto rounded border border-zinc-200">
          <table className="min-w-full text-[12px]">
            <tbody>
          {[
            "verify environment",
            "verify remote-executor",
            "verify control-plane",
          ].map((command) => (
            <tr key={command} className="odd:bg-white even:bg-zinc-50/50">
              <td className="border-b border-zinc-200 px-3 py-2 font-mono text-[11px]">{command}</td>
              <td className="border-b border-zinc-200 px-3 py-2 text-[11px] text-zinc-700">
                Run this from the command console for the same read-only verification output.
              </td>
            </tr>
          ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="rounded border border-zinc-300 bg-white p-3 shadow-sm">
            <h3 className="text-base font-semibold">{group}</h3>
            <div className="mt-3 overflow-x-auto rounded border border-zinc-200">
              <table className="min-w-full text-[12px]">
                <thead className="bg-zinc-100 text-left text-[11px] uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="border-b border-zinc-200 px-3 py-2">Action</th>
                    <th className="border-b border-zinc-200 px-3 py-2">CLI mapping</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Guardrails / artifacts / follow-up</th>
                    <th className="border-b border-zinc-200 px-3 py-2">Modes / scheduling</th>
                  </tr>
                </thead>
                <tbody>
              {items.map((action) => (
                <tr key={action.id} className="align-top odd:bg-white even:bg-zinc-50/50">
                  <td className="border-b border-zinc-200 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-zinc-500">{action.workflowFamily}</div>
                    <div className="font-medium">{action.title}</div>
                    <div className="mt-1 text-[11px] text-zinc-700">{action.description}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {action.execution.mutating ? "mutating" : action.execution.readOnly ? "read-only" : "wrapped"}
                    </div>
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2 font-mono text-[11px] text-zinc-500">{action.cliCommandTemplate}</td>
                  <td className="border-b border-zinc-200 px-3 py-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Guardrails</p>
                      <ul className="mt-1 space-y-1 text-[11px] text-gray-700">
                        {action.guardrails.map((guardrail) => (
                          <li key={`${action.id}-${guardrail}`}>{guardrail}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Expected artifacts</p>
                      <ul className="mt-1 space-y-1 text-[11px] text-gray-700">
                        {action.artifactExpectations.map((artifact) => (
                          <li key={`${action.id}-${artifact.key}`}>{artifact.label}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Follow-up</p>
                      <p className="mt-1 text-[11px] text-gray-700">
                        {action.recommendedFollowUpActionId || "No fixed follow-up."}
                      </p>
                    </div>
                  </td>
                  <td className="border-b border-zinc-200 px-3 py-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Execution modes</p>
                      <p className="mt-1 text-[11px] text-gray-700">
                        {action.executionModes?.allowedModes?.join(", ") || "local_cli"}
                      </p>
                    </div>
                    <div className="mt-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Scheduling</p>
                      <p className="mt-1 text-[11px] text-gray-700">
                        {action.scheduling?.schedulable
                          ? action.scheduling.safeAutoRun
                            ? "Schedulable and safe for automatic preparation"
                            : "Schedulable only with explicit manual triggering"
                          : "Blocked from scheduling"}
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
