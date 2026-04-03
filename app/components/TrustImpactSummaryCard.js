import Link from "next/link";
import { ImpactBadge, statusPillClasses } from "@/app/components/policy-badges";
import {
  getEvidenceStrengthTone,
  getRecordEvidenceStrengthLabel,
  getRecordImpactDirectionLabel,
  getRecordSourceCoverageLabel,
  getRecordTrustStateLabel,
  getSourceCoverageTone,
  getTrustStateTone,
  IMPACT_DIRECTIONS,
} from "@/lib/labels";

function SummaryBadge({ label, tone = "neutral" }) {
  return (
    <span
      className={statusPillClasses(
        tone === "neutral" ? "default" : tone,
        "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      )}
    >
      {label}
    </span>
  );
}

function SummaryRow({ label, value, badgeTone = "neutral", valueNode = null }) {
  return (
    <div className="rounded-[0.95rem] border border-[var(--line)] bg-white/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">{label}</p>
      <div className="mt-2">
        {valueNode || <SummaryBadge label={value} tone={badgeTone} />}
      </div>
    </div>
  );
}

export default function TrustImpactSummaryCard({
  record,
  detailHref = "",
  detailLabel = "View details",
}) {
  const impactDirection = getRecordImpactDirectionLabel(record);
  const evidenceStrength = getRecordEvidenceStrengthLabel(record);
  const sourceCoverage = getRecordSourceCoverageLabel(record);
  const trustIndicator = getRecordTrustStateLabel(record);

  return (
    <div className="mt-4 rounded-[1rem] border border-[var(--line)] bg-[rgba(255,252,247,0.92)] p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
            Trust + Impact Summary
          </p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Compact preview of direction, evidence, source coverage, and trust state.
          </p>
        </div>
        {detailHref ? (
          <Link href={detailHref} className="accent-link text-xs">
            {detailLabel}
          </Link>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SummaryRow
          label="Impact"
          value={impactDirection}
          badgeTone={impactDirection === IMPACT_DIRECTIONS.UNCLEAR ? "warning" : "neutral"}
          valueNode={
            impactDirection !== IMPACT_DIRECTIONS.UNCLEAR ? (
              <ImpactBadge impact={impactDirection} />
            ) : (
              <SummaryBadge label={IMPACT_DIRECTIONS.UNCLEAR} tone="warning" />
            )
          }
        />
        <SummaryRow
          label="Evidence"
          value={evidenceStrength}
          badgeTone={getEvidenceStrengthTone(evidenceStrength)}
        />
        <SummaryRow
          label="Source Coverage"
          value={sourceCoverage}
          badgeTone={getSourceCoverageTone(sourceCoverage)}
        />
        <SummaryRow
          label="Trust"
          value={trustIndicator}
          badgeTone={getTrustStateTone(trustIndicator)}
        />
      </div>
    </div>
  );
}
