"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function statusClasses(status) {
  if (status === "ready") {
    return "border-green-300 bg-green-50 text-green-950";
  }
  if (status === "ready_with_warnings") {
    return "border-amber-300 bg-amber-50 text-amber-950";
  }
  return "border-red-300 bg-red-50 text-red-950";
}

function IssueList({ issues, emptyMessage }) {
  if (!issues?.length) {
    return <p className="text-sm text-gray-600">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {issues.map((issue, index) => (
        <div key={`${issue.type}-${index}`} className="rounded-xl border p-4">
          <p className="font-semibold">{issue.message}</p>
          <p className="text-sm text-gray-700 mt-2">Why: {issue.why}</p>
          <p className="text-sm text-gray-700 mt-1">Fix: {issue.fix}</p>
          {issue.slugs?.length ? (
            <p className="text-xs text-gray-600 mt-2 break-words">
              Slugs: {issue.slugs.join(", ")}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function PreCommitStatusPanel({ workspace }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const batch = workspace.batch;
  const precommit = workspace.latest_pre_commit_review;

  function rerunPrecommit() {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/current-admin/pre-commit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ queuePath: batch?.paths?.queue }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to run pre-commit review.");
        }
        setMessage("Pre-commit review refreshed from the canonical Python command.");
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

  if (!precommit) {
    return (
      <section className="border rounded-2xl p-6 bg-white shadow-sm space-y-4">
        <p>No pre-commit artifact exists for the current batch yet.</p>
        <button
          type="button"
          onClick={rerunPrecommit}
          disabled={isPending}
          className="rounded-lg border px-4 py-2 bg-black text-white"
        >
          Run Pre-Commit
        </button>
        {message ? <p className="text-sm text-gray-700">{message}</p> : null}
      </section>
    );
  }

  const summary = precommit.summary || {};
  const diffPreview = precommit.diff_preview || {
    new_records: [],
    updated_records: [],
    skipped_items: [],
  };

  return (
    <div className="space-y-6">
      <section className={`border rounded-2xl p-5 shadow-sm ${statusClasses(precommit.readiness_status)}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">Current status</p>
            <h2 className="text-2xl font-semibold mt-1">
              {precommit.readiness_label || precommit.readiness_status}
            </h2>
            <p className="mt-3 max-w-3xl">{precommit.readiness_explanation}</p>
            <p className="text-sm mt-3">
              {precommit.readiness_details?.operator_guidance || precommit.recommended_next_step}
            </p>
          </div>
          <button
            type="button"
            onClick={rerunPrecommit}
            disabled={isPending}
            className="rounded-lg border px-4 py-2 bg-white text-black"
          >
            Re-Run Pre-Commit
          </button>
        </div>
        {message ? <p className="text-sm mt-3">{message}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="border rounded-2xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Total items</p>
          <p className="text-xl font-semibold mt-1">{summary.total_items ?? 0}</p>
        </div>
        <div className="border rounded-2xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Approved</p>
          <p className="text-xl font-semibold mt-1">{summary.approved_items ?? 0}</p>
        </div>
        <div className="border rounded-2xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Manual review</p>
          <p className="text-xl font-semibold mt-1">{summary.manual_review_items ?? 0}</p>
        </div>
        <div className="border rounded-2xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Missing decisions</p>
          <p className="text-xl font-semibold mt-1">{summary.missing_decisions ?? 0}</p>
        </div>
        <div className="border rounded-2xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-600">Invalid actions</p>
          <p className="text-xl font-semibold mt-1">{summary.invalid_actions ?? 0}</p>
        </div>
        <div className="border rounded-2xl p-4 bg-white shadow-sm">
          <p className="text-sm text-gray-600">High attention</p>
          <p className="text-xl font-semibold mt-1">{summary.high_attention_items ?? 0}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="border rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-lg font-semibold">Blockers</h3>
            <p className="text-sm text-gray-600 mt-1">Fix these before import.</p>
            <div className="mt-4">
              <IssueList issues={precommit.blocking_issues} emptyMessage="No blockers." />
            </div>
          </div>

          <div className="border rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-lg font-semibold">Warnings</h3>
            <p className="text-sm text-gray-600 mt-1">These do not stop import, but they do deserve review.</p>
            <div className="mt-4">
              <IssueList issues={precommit.linkage_warnings} emptyMessage="No warnings." />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-lg font-semibold">Diff-style preview</h3>
            <p className="text-sm text-gray-600 mt-1">
              This is what the current queue selection would do if imported.
            </p>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-semibold">+ New records ({diffPreview.new_records.length})</p>
                <div className="mt-2 space-y-2">
                  {diffPreview.new_records.slice(0, 8).map((entry) => (
                    <p key={entry.slug}>+ {entry.slug}: {entry.title}</p>
                  ))}
                  {!diffPreview.new_records.length ? <p className="text-gray-600">None</p> : null}
                </div>
              </div>
              <div>
                <p className="font-semibold">~ Updated records ({diffPreview.updated_records.length})</p>
                <div className="mt-2 space-y-2">
                  {diffPreview.updated_records.slice(0, 8).map((entry) => (
                    <p key={entry.slug}>~ {entry.slug}: {entry.title}</p>
                  ))}
                  {!diffPreview.updated_records.length ? <p className="text-gray-600">None</p> : null}
                </div>
              </div>
              <div>
                <p className="font-semibold">- Skipped items ({diffPreview.skipped_items.length})</p>
                <div className="mt-2 space-y-2">
                  {diffPreview.skipped_items.slice(0, 8).map((entry) => (
                    <p key={entry.slug}>- {entry.slug}: {entry.reason}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-lg font-semibold">Linkage and confidence</h3>
            <p className="text-sm text-gray-600 mt-1">These are guidance signals only.</p>
            <div className="mt-4 space-y-2 text-sm">
              <p>Queue → Review: {precommit.artifact_linkage?.queue_to_review || "unknown"}</p>
              <p>Decision file → Review: {precommit.artifact_linkage?.decision_template_to_review || "unknown"}</p>
              <p>Decision log → Review: {precommit.artifact_linkage?.decision_log_to_review || "unknown"}</p>
              <p>Low-confidence items: {precommit.low_confidence_items?.length || 0}</p>
              <p className="pt-2 font-semibold">Recommended next step</p>
              <p>{precommit.recommended_next_step}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
