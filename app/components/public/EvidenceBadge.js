import { StatusPill } from "@/app/components/dashboard/primitives";

export default function EvidenceBadge({
  signal = null,
  className = "",
  prefix = null,
}) {
  if (!signal?.label) {
    return null;
  }

  const text = prefix ? `${prefix}: ${signal.label}` : signal.label;

  return (
    <div className={className}>
      <StatusPill tone={signal.tone || "default"}>{text}</StatusPill>
    </div>
  );
}
