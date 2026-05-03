import { Panel, StatusPill } from "@/app/components/dashboard/primitives";

export default function ResearchCoveragePanel({
  coverage = null,
  strengtheningNote = null,
  eyebrow = "Research coverage",
}) {
  if (!coverage && !strengtheningNote) {
    return null;
  }

  return (
    <Panel padding="md" className="space-y-3">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {eyebrow}
      </p>
      {coverage ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={coverage.tone}>{coverage.label}</StatusPill>
          </div>
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            {coverage.description}
          </p>
        </>
      ) : null}
      {strengtheningNote ? (
        <div className="space-y-2 border-t border-[var(--line)] pt-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {strengtheningNote.title}
          </p>
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            {strengtheningNote.description}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
