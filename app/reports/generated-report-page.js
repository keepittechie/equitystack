import Link from "next/link";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  ImpactOverviewCards,
  SectionIntro,
} from "@/app/components/public/core";
import { Panel } from "@/app/components/dashboard/primitives";
import { RecentPolicyChangesTable } from "@/app/components/public/entities";

function normalizeText(value) {
  return String(value || "").trim();
}

function recordTypeLabel(item = {}) {
  const explicitType = normalizeText(item.display_record_type || item.record_type);
  const linkedType = normalizeText(item.linked_record_type);
  const policyType = normalizeText(item.policy_type).toLowerCase();
  const candidate = explicitType || linkedType;
  const normalized = candidate.toLowerCase();

  if (normalized.includes("bill") || policyType === "legislative") return "BILL";
  if (normalized.includes("promise") || policyType === "current_admin") return "PROMISE";
  if (normalized.includes("report")) return "REPORT";
  if (normalized.includes("policy")) return "POLICY";
  return "RECORD UPDATE";
}

function directionLabel(item = {}) {
  const direction = normalizeText(item.impact_direction || item.status);
  const normalized = direction.toLowerCase();

  if (normalized.includes("positive")) return "Positive Impact";
  if (normalized.includes("negative")) return "Negative Impact";
  if (normalized.includes("mixed")) return "Mixed Impact";
  if (normalized.includes("blocked") || normalized.includes("stalled")) {
    return "Stalled / Blocked";
  }
  return direction || "—";
}

export default function GeneratedReportPage({
  eyebrow,
  title,
  description,
  countLabel,
  countDescription,
  rows,
  emptyTitle,
  emptyDescription,
}) {
  return (
    <main className="space-y-4">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/reports", label: "Reports" },
          { label: title },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={
            <Link href="/reports" className="dashboard-button-secondary">
              Back to reports
            </Link>
          }
        />
      </section>

      <ImpactOverviewCards
        items={[
          {
            label: countLabel,
            value: rows.length,
            description: countDescription,
            tone: "accent",
          },
        ]}
      />

      <Panel className="overflow-hidden">
        <div className="p-4">
          <RecentPolicyChangesTable
            items={rows}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            showScoreImpact
            showWhyThisMatters
            formatRecordType={recordTypeLabel}
            formatDirection={directionLabel}
          />
        </div>
      </Panel>
    </main>
  );
}
