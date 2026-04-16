import Link from "next/link";
import { promises as fs } from "node:fs";
import path from "node:path";
import { listSerializedOperatorActions } from "@/lib/server/admin-operator/actionRegistry.js";
import { getOperatorVerificationReport } from "@/lib/server/admin-operator/verificationService.js";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";

export const dynamic = "force-dynamic";

const INTEGRITY_REPORT_DIR = path.join(process.cwd(), "python", "reports", "integrity");

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
    <span className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-soft)]">
      {status}
    </span>
  );
}

async function readIntegrityArtifact(fileName) {
  const filePath = path.join(INTEGRITY_REPORT_DIR, fileName);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const payload = JSON.parse(raw);
    return {
      fileName,
      filePath,
      payload,
    };
  } catch {
    return null;
  }
}

function buildReasonCounts(clusters = []) {
  const bucket = {};
  for (const cluster of clusters) {
    for (const reason of cluster.auto_merge_rejected_reasons || []) {
      bucket[reason] = (bucket[reason] || 0) + 1;
    }
  }
  return Object.entries(bucket).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function IntegrityArtifactCard({ title, artifact, children }) {
  return (
    <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">integrity artifact</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--admin-text)]">{title}</h3>
          {artifact ? (
            <>
              <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">
                Generated at {formatAdminDateTime(artifact.payload.generated_at)}
              </p>
              <p className="mt-1 font-mono text-[10px] text-[var(--admin-text-soft)]">{artifact.filePath}</p>
            </>
          ) : (
            <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">
              No artifact generated yet. Run the source-integrity cleanup script to create it.
            </p>
          )}
        </div>
        <StatusBadge status={artifact ? "available" : "missing"} />
      </div>
      {artifact ? <div className="mt-3 text-[11px] text-[var(--admin-text-soft)]">{children}</div> : null}
    </section>
  );
}

function VerificationReportCard({ report }) {
  return (
    <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">{report.scope}</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--admin-text)]">{report.title}</h3>
          <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">Checked at {formatAdminDateTime(report.checkedAt)}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <div className="mt-3 overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
        <table className="min-w-full text-[12px]">
          <thead className="bg-[var(--admin-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
            <tr>
              <th className="border-b border-[var(--admin-line)] px-3 py-2">Check</th>
              <th className="border-b border-[var(--admin-line)] px-3 py-2">Status</th>
              <th className="border-b border-[var(--admin-line)] px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
        {report.checks.map((check) => (
          <tr key={check.id} className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)] hover:bg-[var(--admin-surface-soft)]">
            <td className="border-b border-[var(--admin-line)] px-3 py-2">
              <div className="font-medium text-[var(--admin-text)]">{check.name}</div>
              <div className="mt-1 text-[11px] text-[var(--admin-text-soft)]">{check.summary}</div>
            </td>
            <td className="border-b border-[var(--admin-line)] px-3 py-2">
              <StatusBadge status={check.status} />
            </td>
            <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-muted)]">
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
  const [environmentReport, remoteExecutorReport, controlPlaneReport, dataIntegrityReport, deepIntegrityReport, cleanupArtifact, duplicateManualArtifact, attributionManualArtifact] = await Promise.all([
    getOperatorVerificationReport("environment"),
    getOperatorVerificationReport("remote-executor"),
    getOperatorVerificationReport("control-plane"),
    getOperatorVerificationReport("data-integrity"),
    getOperatorVerificationReport("deep-integrity"),
    readIntegrityArtifact("source_integrity_cleanup_report.json"),
    readIntegrityArtifact("source_duplicate_manual_review.json"),
    readIntegrityArtifact("source_attribution_manual_review.json"),
  ]);
  const duplicateReasonCounts = duplicateManualArtifact
    ? buildReasonCounts(duplicateManualArtifact.payload.clusters || [])
    : [];

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">Tools / Registry</p>
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Verification and registered operator actions</h2>
        <p className="max-w-5xl text-[12px] text-[var(--admin-text-soft)]">
          Verification checks are read-only and never enqueue broker jobs. Use them to confirm production readiness
          on 10.10.0.13, remote executor health against 10.10.0.60, and control-plane configuration before you rely
          on remote mode in the operator surface. The data-integrity report checks canonical promise, source,
          relationship, and legislative-link records for missing fields, orphans, duplicates, and attribution gaps.
          The deep-integrity report adds source-gap classification, duplicate-source merge safety, and current-admin
          provenance completeness.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-5">
        <VerificationReportCard report={environmentReport} />
        <VerificationReportCard report={remoteExecutorReport} />
        <VerificationReportCard report={controlPlaneReport} />
        <VerificationReportCard report={dataIntegrityReport} />
        <VerificationReportCard report={deepIntegrityReport} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <IntegrityArtifactCard title="Source integrity cleanup report" artifact={cleanupArtifact}>
          <div>Mode: {cleanupArtifact?.payload?.mode || "unknown"}</div>
          <div>
            Duplicate groups: {cleanupArtifact?.payload?.duplicate_merge?.duplicate_group_count_before ?? 0} before /{" "}
            {cleanupArtifact?.payload?.duplicate_merge?.duplicate_group_count_after ?? 0} after
          </div>
          <div>
            Safe merges executed: {(cleanupArtifact?.payload?.duplicate_merge?.executed_merges || []).length}
          </div>
          <div>
            Deterministic source backfills: {cleanupArtifact?.payload?.source_backfill?.repaired_action_count ?? 0} actions /{" "}
            {cleanupArtifact?.payload?.source_backfill?.repaired_outcome_count ?? 0} outcomes
          </div>
          <div>
            Remaining missing attribution: {cleanupArtifact?.payload?.source_backfill?.missing_actions_after ?? 0} actions /{" "}
            {cleanupArtifact?.payload?.source_backfill?.missing_outcomes_after ?? 0} outcomes
          </div>
        </IntegrityArtifactCard>

        <IntegrityArtifactCard title="Duplicate source manual review export" artifact={duplicateManualArtifact}>
          <div>Clusters requiring manual review: {duplicateManualArtifact?.payload?.manual_review_group_count ?? 0}</div>
          {duplicateReasonCounts.length ? (
            <div className="mt-2">
              Top rejection reasons:
              <ul className="mt-1 space-y-1">
                {duplicateReasonCounts.slice(0, 5).map(([reason, count]) => (
                  <li key={reason}>
                    {reason}: {count}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3">
            <Link href="/admin/source-curation" className="text-[var(--admin-link)] underline">
              Open duplicate source review
            </Link>
          </div>
        </IntegrityArtifactCard>

        <IntegrityArtifactCard title="Source attribution manual follow-up" artifact={attributionManualArtifact}>
          <div>Remaining missing actions: {attributionManualArtifact?.payload?.remaining_missing_actions ?? 0}</div>
          <div>Remaining missing outcomes: {attributionManualArtifact?.payload?.remaining_missing_outcomes ?? 0}</div>
          <div className="mt-2">Top unresolved action groups:</div>
          <ul className="mt-1 space-y-1">
            {(attributionManualArtifact?.payload?.unresolved_action_groups || []).slice(0, 5).map((group) => (
              <li key={`${group.president_slug}:${group.topic}:${group.likely_import_origin}`}>
                {group.president_slug} / {group.topic} / {group.likely_import_origin}: {group.row_count}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Link href="/admin/source-curation" className="text-[var(--admin-link)] underline">
              Open source curation
            </Link>
          </div>
        </IntegrityArtifactCard>
      </section>

      <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
        <h3 className="text-base font-semibold text-[var(--admin-text)]">Deterministic verification commands</h3>
        <div className="mt-3 overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
          <table className="min-w-full text-[12px]">
            <tbody>
          {[
            "verify environment",
            "verify remote-executor",
            "verify control-plane",
            "verify data-integrity",
            "verify deep-integrity",
          ].map((command) => (
            <tr key={command} className="odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)] hover:bg-[var(--admin-surface-soft)]">
              <td className="border-b border-[var(--admin-line)] px-3 py-2 font-mono text-[11px] text-[var(--admin-text)]">{command}</td>
              <td className="border-b border-[var(--admin-line)] px-3 py-2 text-[11px] text-[var(--admin-text-soft)]">
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
          <div key={group} className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3 shadow-sm">
            <h3 className="text-base font-semibold text-[var(--admin-text)]">{group}</h3>
            <div className="mt-3 overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
              <table className="min-w-full text-[12px]">
                <thead className="bg-[var(--admin-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                  <tr>
                    <th className="border-b border-[var(--admin-line)] px-3 py-2">Action</th>
                    <th className="border-b border-[var(--admin-line)] px-3 py-2">CLI mapping</th>
                    <th className="border-b border-[var(--admin-line)] px-3 py-2">Guardrails / artifacts / follow-up</th>
                    <th className="border-b border-[var(--admin-line)] px-3 py-2">Modes / scheduling</th>
                  </tr>
                </thead>
                <tbody>
              {items.map((action) => (
                <tr key={action.id} className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)] hover:bg-[var(--admin-surface-soft)]">
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">{action.workflowFamily}</div>
                    <div className="font-medium text-[var(--admin-text)]">{action.title}</div>
                    <div className="mt-1 text-[11px] text-[var(--admin-text-soft)]">{action.description}</div>
                    <div className="mt-1 text-[11px] text-[var(--admin-text-muted)]">
                      {action.execution.mutating ? "mutating" : action.execution.readOnly ? "read-only" : "wrapped"}
                    </div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2 font-mono text-[11px] text-[var(--admin-text)]">{action.cliCommandTemplate}</td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">Guardrails</p>
                      <ul className="mt-1 space-y-1 text-[11px] text-[var(--admin-text-soft)]">
                        {action.guardrails.map((guardrail) => (
                          <li key={`${action.id}-${guardrail}`}>{guardrail}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">Expected artifacts</p>
                      <ul className="mt-1 space-y-1 text-[11px] text-[var(--admin-text-soft)]">
                        {action.artifactExpectations.map((artifact) => (
                          <li key={`${action.id}-${artifact.key}`}>{artifact.label}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">Follow-up</p>
                      <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
                        {action.recommendedFollowUpActionId || "No fixed follow-up."}
                      </p>
                    </div>
                  </td>
                  <td className="border-b border-[var(--admin-line)] px-3 py-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">Execution modes</p>
                      <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
                        {action.executionModes?.allowedModes?.join(", ") || "local_cli"}
                      </p>
                    </div>
                    <div className="mt-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">Scheduling</p>
                      <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">
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
