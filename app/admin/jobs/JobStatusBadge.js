function statusClasses(status) {
  if (status === "success") {
    return "border-green-300 bg-green-100 text-green-900";
  }
  if (status === "running" || status === "queued") {
    return "border-amber-300 bg-amber-100 text-amber-900";
  }
  if (status === "blocked") {
    return "border-orange-300 bg-orange-100 text-orange-900";
  }
  if (status === "failed" || status === "cancelled") {
    return "border-red-300 bg-red-100 text-red-900";
  }
  return "border-gray-300 bg-gray-100 text-gray-900";
}

export default function JobStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${statusClasses(status)}`}>
      {status}
    </span>
  );
}
