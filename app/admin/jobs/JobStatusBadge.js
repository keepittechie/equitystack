function statusClasses(status) {
  if (status === "success") {
    return "border-[#A7F3D0] bg-[#ECFDF5] text-[#10B981]";
  }
  if (status === "running" || status === "queued") {
    return "border-[#BFDBFE] bg-[#EFF6FF] text-[#3B82F6]";
  }
  if (status === "stopped_for_operator_review") {
    return "border-[#FDE68A] bg-[#FFFBEB] text-[#F59E0B]";
  }
  if (status === "stopped_for_admin_approval") {
    return "border-[#FDE68A] bg-[#FFFBEB] text-[#F59E0B]";
  }
  if (status === "blocked") {
    return "border-[#FDE68A] bg-[#FFFBEB] text-[#F59E0B]";
  }
  if (status === "failed" || status === "cancelled") {
    return "border-[#FECACA] bg-[#FEF2F2] text-[#EF4444]";
  }
  return "border-[#E5EAF0] bg-[#F3F4F6] text-[#1F2937]";
}

export default function JobStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${statusClasses(status)}`}>
      {status}
    </span>
  );
}
