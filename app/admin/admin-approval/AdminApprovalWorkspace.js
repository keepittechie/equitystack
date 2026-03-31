"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function permissionLabel(permission) {
  return permission?.allowed ? "Ready" : "Blocked";
}

function permissionTone(permission) {
  return permission?.allowed
    ? "border-green-200 bg-green-50 text-green-900"
    : "border-amber-200 bg-amber-50 text-amber-900";
}

function runStateLabel(report, ready) {
  if (report) {
    return "Completed";
  }
  return ready ? "Ready" : "Waiting";
}

function ApprovalStepTable({ title, description, rows }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="border-b px-3 py-2 font-medium">Step</th>
              <th className="border-b px-3 py-2 font-medium">Status</th>
              <th className="border-b px-3 py-2 font-medium">Gate</th>
              <th className="border-b px-3 py-2 font-medium">Command</th>
              <th className="border-b px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top last:border-b-0">
                <td className="px-3 py-2">
                  <p className="font-medium text-gray-900">{row.label}</p>
                  {row.detail ? <p className="mt-1 text-xs text-gray-600">{row.detail}</p> : null}
                </td>
                <td className="px-3 py-2 text-gray-700">{row.statusLabel}</td>
                <td className="px-3 py-2">
                  <div className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${permissionTone(row.permission)}`}>
                    {permissionLabel(row.permission)}
                  </div>
                  {!row.permission?.allowed && row.permission?.reasons?.length ? (
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      {row.permission.reasons.slice(0, 2).map((reason) => (
                        <p key={reason}>{reason}</p>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{row.command}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {row.action}
                    {row.secondaryAction || null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminApprovalWorkspace({ currentAdmin, legislative }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const currentPermissions = currentAdmin.action_permissions || {};
  const legislativePermissions = legislative.action_permissions || {};
  const currentQueuePath = currentAdmin.batch?.paths?.queue || "";

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

  const currentAdminRows = [
    {
      id: "current-admin-dry-run",
      label: "Dry-Run Import",
      detail: "Preview the current-admin import without writing changes.",
      statusLabel: runStateLabel(currentAdmin.latest_import_dry_run, currentPermissions.run_import_dry_run?.allowed),
      permission: currentPermissions.run_import_dry_run || { allowed: false, reasons: [] },
      command: "./bin/equitystack current-admin import --input <canonical queue>",
      action: (
        <button
          type="button"
          onClick={() =>
            runAction(
              "/api/admin/current-admin/import",
              { queuePath: currentQueuePath, mode: "dry-run" },
              "Current-admin dry-run import finished."
            )
          }
          disabled={isPending || !currentPermissions.run_import_dry_run?.allowed}
          className="rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run
        </button>
      ),
      secondaryAction: (
        <Link href="/admin/import-history" className="rounded-lg border px-3 py-1.5 text-sm">
          Details
        </Link>
      ),
    },
    {
      id: "current-admin-apply",
      label: "Apply Import",
      detail: "Write the approved current-admin import through the canonical CLI.",
      statusLabel: runStateLabel(currentAdmin.latest_import_apply, currentPermissions.apply_import?.allowed),
      permission: currentPermissions.apply_import || { allowed: false, reasons: [] },
      command: "./bin/equitystack current-admin import --input <canonical queue> --apply --yes",
      action: (
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Apply the current-admin import?")) {
              return;
            }
            runAction(
              "/api/admin/current-admin/import",
              { queuePath: currentQueuePath, mode: "apply", confirmed: true },
              "Current-admin import apply finished."
            );
          }}
          disabled={isPending || !currentPermissions.apply_import?.allowed}
          className="rounded-lg border bg-black px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Apply
        </button>
      ),
      secondaryAction: (
        <Link href="/admin/import-history" className="rounded-lg border px-3 py-1.5 text-sm">
          Details
        </Link>
      ),
    },
    {
      id: "current-admin-validate",
      label: "Validate Import",
      detail: "Validate the applied current-admin import and review any recorded issues.",
      statusLabel: currentAdmin.latest_validation ? "Completed" : currentPermissions.validate_import?.allowed ? "Ready" : "Waiting",
      permission: currentPermissions.validate_import || { allowed: false, reasons: [] },
      command: "./bin/equitystack current-admin validate --input <canonical queue>",
      action: (
        <button
          type="button"
          onClick={() =>
            runAction(
              "/api/admin/current-admin/validate",
              { queuePath: currentQueuePath },
              "Current-admin validation finished."
            )
          }
          disabled={isPending || !currentPermissions.validate_import?.allowed}
          className="rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          Validate
        </button>
      ),
      secondaryAction: (
        <Link href="/admin/import-history" className="rounded-lg border px-3 py-1.5 text-sm">
          Details
        </Link>
      ),
    },
  ];

  const legislativeRows = [
    {
      id: "legislative-apply-dry-run",
      label: "Apply Dry-Run",
      detail: "Preview approved legislative bundle actions before apply.",
      statusLabel: runStateLabel(legislative.apply_report, legislativePermissions.run_apply_dry_run?.allowed),
      permission: legislativePermissions.run_apply_dry_run || { allowed: false, reasons: [] },
      command: "./bin/equitystack legislative apply --dry-run",
      action: (
        <button
          type="button"
          onClick={() =>
            runAction(
              "/api/admin/legislative/apply",
              { mode: "dry-run" },
              "Legislative apply dry-run finished."
            )
          }
          disabled={isPending || !legislativePermissions.run_apply_dry_run?.allowed}
          className="rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run
        </button>
      ),
      secondaryAction: (
        <Link href="/admin/legislative-workflow" className="rounded-lg border px-3 py-1.5 text-sm">
          Details
        </Link>
      ),
    },
    {
      id: "legislative-apply",
      label: "Apply Approved Actions",
      detail: "Apply the reviewed legislative bundle through the wrapped CLI.",
      statusLabel: legislative.apply_report?.mode === "apply" ? "Completed" : legislativePermissions.apply_bundle?.allowed ? "Ready" : "Waiting",
      permission: legislativePermissions.apply_bundle || { allowed: false, reasons: [] },
      command: "./bin/equitystack legislative apply --apply --yes",
      action: (
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Apply the approved legislative bundle actions?")) {
              return;
            }
            runAction(
              "/api/admin/legislative/apply",
              { mode: "apply", confirmed: true },
              "Legislative apply finished."
            );
          }}
          disabled={isPending || !legislativePermissions.apply_bundle?.allowed}
          className="rounded-lg border bg-black px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Apply
        </button>
      ),
      secondaryAction: (
        <Link href="/admin/legislative-workflow" className="rounded-lg border px-3 py-1.5 text-sm">
          Details
        </Link>
      ),
    },
    {
      id: "legislative-import-dry-run",
      label: "Import Dry-Run",
      detail: "Preview approved tracked-bill import rows after legislative apply.",
      statusLabel: runStateLabel(legislative.import_report, legislativePermissions.run_import_dry_run?.allowed),
      permission: legislativePermissions.run_import_dry_run || { allowed: false, reasons: [] },
      command: "./bin/equitystack legislative import --dry-run",
      action: (
        <button
          type="button"
          onClick={() =>
            runAction(
              "/api/admin/legislative/import",
              { mode: "dry-run" },
              "Legislative import dry-run finished."
            )
          }
          disabled={isPending || !legislativePermissions.run_import_dry_run?.allowed}
          className="rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run
        </button>
      ),
      secondaryAction: (
        <Link href="/admin/legislative-workflow" className="rounded-lg border px-3 py-1.5 text-sm">
          Details
        </Link>
      ),
    },
    {
      id: "legislative-import-apply",
      label: "Apply Import",
      detail: "Write the approved tracked-bill import through the wrapped CLI.",
      statusLabel: legislative.import_report?.mode === "apply" ? "Completed" : legislativePermissions.apply_import?.allowed ? "Ready" : "Waiting",
      permission: legislativePermissions.apply_import || { allowed: false, reasons: [] },
      command: "./bin/equitystack legislative import --apply --yes",
      action: (
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Apply the legislative import?")) {
              return;
            }
            runAction(
              "/api/admin/legislative/import",
              { mode: "apply", confirmed: true },
              "Legislative import apply finished."
            );
          }}
          disabled={isPending || !legislativePermissions.apply_import?.allowed}
          className="rounded-lg border bg-black px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Apply
        </button>
      ),
      secondaryAction: (
        <Link href="/admin/legislative-workflow" className="rounded-lg border px-3 py-1.5 text-sm">
          Details
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">Current-Admin</p>
          <p className="mt-2 text-xl font-semibold">{currentAdmin.batch?.stage || "Unavailable"}</p>
          <p className="mt-2 text-sm text-gray-600">
            Dry-run: {currentAdmin.action_permissions?.run_import_dry_run?.allowed ? "ready" : "blocked"}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">Legislative</p>
          <p className="mt-2 text-xl font-semibold">{legislative.workflow_status || "Unavailable"}</p>
          <p className="mt-2 text-sm text-gray-600">
            Apply: {legislative.action_permissions?.apply_bundle?.allowed ? "ready" : "blocked"}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">Current-Admin Queue</p>
          <p className="mt-2 text-sm break-all">{currentQueuePath || "Unavailable"}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-600">Workflow Handoff</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <Link href="/admin/operator-console" className="underline">
              Workflow Console
            </Link>
            <Link href="/admin/current-admin-review" className="underline">
              Current-Admin Review
            </Link>
            <Link href="/admin/legislative-workflow" className="underline">
              Legislative Review
            </Link>
          </div>
        </div>
      </section>

      <ApprovalStepTable
        title="Current-Admin Approval Gate"
        description="This is the explicit second stop point after operator review and pre-commit. Import execution still runs only through the existing wrapped current-admin routes."
        rows={currentAdminRows}
      />

      <ApprovalStepTable
        title="Legislative Approval Gate"
        description="This is the supervised second stop point after bundle review. Apply and import execution still run only through the existing wrapped legislative routes."
        rows={legislativeRows}
      />

      {message ? (
        <section className="rounded-2xl border bg-white p-4 text-sm shadow-sm">
          {message}
        </section>
      ) : null}
    </div>
  );
}
