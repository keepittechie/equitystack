function statusClasses(status) {
  if (status === "success") {
    return "border-[var(--admin-success-line)] bg-[var(--admin-success-surface)] text-[var(--success)]";
  }
  if (status === "running" || status === "queued") {
    return "border-[var(--admin-info-line)] bg-[var(--admin-info-surface)] text-[var(--admin-link)]";
  }
  if (status === "stopped_for_operator_review") {
    return "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] text-[var(--warning)]";
  }
  if (status === "stopped_for_admin_approval") {
    return "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] text-[var(--warning)]";
  }
  if (status === "blocked") {
    return "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] text-[var(--warning)]";
  }
  if (status === "failed" || status === "cancelled") {
    return "border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] text-[var(--danger)]";
  }
  return "border-[var(--admin-line)] bg-[var(--admin-surface-soft)] text-[var(--admin-text)]";
}

export default function JobStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${statusClasses(status)}`}>
      {status}
    </span>
  );
}
