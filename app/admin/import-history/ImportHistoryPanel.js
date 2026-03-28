"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function ImportSummaryCard({ title, report }) {
  return (
    <div className="border rounded-2xl p-5 bg-white shadow-sm">
      <p className="text-sm text-gray-600">{title}</p>
      {report ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-semibold">{report.mode || report.batch_name}</p>
          <p>Created: {report.promises_created ?? 0}</p>
          <p>Updated: {report.promises_updated ?? 0}</p>
          <p>Actions: {report.actions_created ?? 0}</p>
          <p>Outcomes: {report.outcomes_created ?? 0}</p>
          <p>Conflicts: {report.conflicts?.length || 0}</p>
          <p>Notes: {report.notes?.length || 0}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-600">No report available yet.</p>
      )}
    </div>
  );
}

export default function ImportHistoryPanel({ workspace }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const batch = workspace.batch;
  const precommit = workspace.latest_pre_commit_review;

  function runAction(url, body, successMessage) {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Action failed.");
        }
        setMessage(successMessage);
        router.refresh();
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  if (!batch) {
    return (
      <section className="border rounded-2xl p-6 bg-white shadow-sm">
        <p>No current-admin batch is available yet.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="border rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600">Queue path</p>
            <p className="text-sm break-all">{batch.paths.queue}</p>
            <p className="text-sm text-gray-700 mt-3">
              Nothing is written unless Apply is confirmed.
            </p>
            <p className="text-sm text-gray-700 mt-1">
              Current readiness: {precommit?.readiness_status || "missing"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                runAction(
                  "/api/admin/current-admin/import",
                  { queuePath: batch.paths.queue, mode: "dry-run" },
                  "Dry-run import finished. Review the new import report before applying."
                )
              }
              disabled={isPending}
              className="rounded-lg border px-4 py-2 bg-white"
            >
              Run Dry-Run Import
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Apply import? This writes through the canonical Python import step.")) {
                  return;
                }
                runAction(
                  "/api/admin/current-admin/import",
                  { queuePath: batch.paths.queue, mode: "apply", confirmed: true },
                  "Apply import finished. Run validation next."
                );
              }}
              disabled={isPending}
              className="rounded-lg border px-4 py-2 bg-black text-white"
            >
              Apply Import
            </button>
            <button
              type="button"
              onClick={() =>
                runAction(
                  "/api/admin/current-admin/validate",
                  { queuePath: batch.paths.queue },
                  "Validation finished. Review the validation report for issues."
                )
              }
              disabled={isPending}
              className="rounded-lg border px-4 py-2 bg-white"
            >
              Validate Import
            </button>
          </div>
        </div>
        {message ? <p className="text-sm text-gray-700">{message}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ImportSummaryCard title="Latest dry-run import" report={workspace.latest_import_dry_run} />
        <ImportSummaryCard title="Latest apply import" report={workspace.latest_import_apply} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-lg font-semibold">Dry-run and apply details</h2>
          <div className="mt-4 space-y-4 text-sm">
            {[workspace.latest_import_dry_run, workspace.latest_import_apply]
              .filter(Boolean)
              .map((report) => (
                <div key={report.file_path} className="rounded-xl border p-4">
                  <p className="font-semibold">{report.file_name}</p>
                  <p className="mt-2 break-all">Path: {report.file_path}</p>
                  {report.conflicts?.length ? (
                    <div className="mt-3">
                      <p className="font-medium">Conflicts</p>
                      {report.conflicts.slice(0, 5).map((entry, index) => (
                        <p key={index} className="text-gray-700">
                          {entry.type || "conflict"}: {entry.title || entry.existing_slug || "See report"}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {report.notes?.length ? (
                    <div className="mt-3">
                      <p className="font-medium">Notes</p>
                      {report.notes.slice(0, 5).map((entry) => (
                        <p key={entry} className="text-gray-700">{entry}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            {!workspace.latest_import_dry_run && !workspace.latest_import_apply ? (
              <p className="text-gray-600">No import reports exist yet for this batch.</p>
            ) : null}
          </div>
        </div>

        <div className="border rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-lg font-semibold">Validation</h2>
          {workspace.latest_validation ? (
            <div className="mt-4 space-y-3 text-sm">
              <p>Validated records: {workspace.latest_validation.validated_count}</p>
              <p>Issues: {workspace.latest_validation.issues.length}</p>
              <p className="break-all">Report: {workspace.latest_validation.file_path}</p>
              <div className="rounded-xl border p-4">
                <p className="font-medium">Recent issues</p>
                <div className="mt-2 space-y-2">
                  {workspace.latest_validation.issues.slice(0, 8).map((issue, index) => (
                    <p key={`${issue.slug}-${index}`}>
                      {issue.slug}: {issue.issue}
                    </p>
                  ))}
                  {!workspace.latest_validation.issues.length ? (
                    <p className="text-gray-600">No validation issues were recorded.</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-600">No validation report exists yet for this batch.</p>
          )}
        </div>
      </section>
    </div>
  );
}
