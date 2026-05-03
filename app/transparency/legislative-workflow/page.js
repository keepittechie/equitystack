import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  KpiCard,
  SectionIntro,
} from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import {
  Panel,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
} from "@/lib/structured-data";
import { getLegislativeWorkflowTransparencyData } from "@/lib/services/legislativeWorkflowTransparencyService";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Legislative Workflow Transparency | EquityStack",
  description:
    "Learn how EquityStack checks legislative bill links, where human review still matters, and what the latest public-safe workflow status means.",
  path: "/transparency/legislative-workflow",
  keywords: [
    "EquityStack legislative workflow",
    "legislative transparency",
    "future bills workflow",
    "Direct vs Partial bill links",
    "public workflow safeguards",
  ],
});

const WORKFLOW_DOES = [
  {
    title: "Maps future policy ideas to tracked bills",
    body:
      "The workflow compares future policy ideas with real tracked bills so public legislative pages can show when a proposal lines up strongly, partially, or not enough to support a clean public link.",
  },
  {
    title: "Classifies link strength conservatively",
    body:
      "It separates strong matches from partial overlap and uncertain cases instead of forcing every proposal into a simple yes-or-no match.",
  },
  {
    title: "Removes weak or stale links",
    body:
      "Weak evidence, stale links, or outdated review rows are supposed to be cleared so public legislative context stays more defensible over time.",
  },
];

const WORKFLOW_DOES_NOT = [
  {
    title: "It does not treat legislative procedure as final impact analysis",
    body:
      "A bill link can show that a proposal moved, stalled, or passed. That is not the same thing as a full downstream Black-impact conclusion.",
  },
  {
    title: "It does not auto-approve destructive review actions",
    body:
      "Automation is limited to safer cases. Edge cases and riskier state changes still need guarded review and apply steps.",
  },
  {
    title: "It does not eliminate human judgment",
    body:
      "Gray-zone cases still go to review-needed status rather than being silently forced into a public relationship category.",
  },
];

const SAFEGUARDS = [
  {
    title: "Conservative classification thresholds",
    body:
      "Direct links require stronger alignment than Partial links, and uncertain matches are kept out of the strongest bucket.",
  },
  {
    title: "Human review for gray-zone cases",
    body:
      "If the workflow finds a case that is not clearly strong or clearly weak, it can hold that row for human review instead of publishing a confident label.",
  },
  {
    title: "Safe auto-triage only",
    body:
      "Automation is limited to safer approval paths. The workflow does not use auto-triage to silently approve destructive legislative changes.",
  },
  {
    title: "Guarded apply stage",
    body:
      "Approved changes still go through a separate apply stage so review and execution stay distinct.",
  },
  {
    title: "Repair for stale state",
    body:
      "If review state drifts away from the canonical record, the repair stage can reconcile already-resolved or stale actions.",
  },
  {
    title: "Health and anomaly checks",
    body:
      "Read-only health and anomaly reports help detect missing artifacts, stale workflow state, or suspicious classification patterns before they are treated as clean.",
  },
];

const LINK_TYPES = [
  {
    title: "Direct",
    body:
      "Direct means the workflow found a strong relationship between a future policy idea and a tracked bill. It signals a close match, not a final judgment about downstream impact.",
  },
  {
    title: "Partial",
    body:
      "Partial means there is meaningful overlap, but the bill does not fully match the future policy idea. It is a bounded relationship, not a weak substitute for Direct.",
  },
  {
    title: "Review-needed",
    body:
      "Review-needed means the workflow found an uncertain case that still benefits from a human check before a public relationship label is treated as settled.",
  },
];

const LIMITS = [
  "Workflow health is about legislative-link quality, not a complete judgment of the entire site.",
  "A healthy legislative workflow does not mean every public policy impact question is settled.",
  "A failed or warning workflow status does not automatically mean all public legislative data is wrong. It means the latest review cycle needs caution or follow-up.",
  "Procedural legislative outcomes should be read alongside policy pages, reports, and source trails when the question is about real-world impact.",
];

const RELATED_LINKS = [
  {
    href: "/methodology",
    title: "Read the main methodology page",
    description:
      "Use the broader methodology page when you want the site-wide rules behind scores, statuses, and evidence treatment.",
  },
  {
    href: "/bills",
    title: "Browse tracked bills",
    description:
      "Open the bills surface when you want to inspect the public legislative records that this workflow helps keep organized.",
  },
  {
    href: "/future-bills",
    title: "Browse future policy ideas",
    description:
      "Use the future-bills surface to see the proposal side of the relationship the workflow is trying to classify carefully.",
  },
  {
    href: "/sources",
    title: "Review public sources",
    description:
      "Open the source library when the legislative relationship depends on visible evidence and you want to inspect that trail directly.",
  },
];

function getStatusTone(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PASS") {
    return "success";
  }
  if (normalized === "FAIL") {
    return "danger";
  }
  return "warning";
}

function formatTimestamp(value) {
  if (!value) {
    return "Not available";
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  }).format(timestamp);
}

function formatYesNo(value) {
  return value ? "Yes" : "No";
}

export default async function LegislativeWorkflowTransparencyPage() {
  const data = await getLegislativeWorkflowTransparencyData();

  return (
    <main className="space-y-5">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { label: "Legislative workflow transparency" },
            ],
            "/transparency/legislative-workflow"
          ),
          buildWebPageJsonLd({
            title: "Legislative Workflow Transparency",
            description:
              "A public-safe explanation of how EquityStack checks legislative bill links, what safeguards exist, and what the latest workflow status means.",
            path: "/transparency/legislative-workflow",
            about: [
              "EquityStack legislative workflow",
              "future bill links",
              "tracked bills",
              "workflow transparency",
              "public safeguards",
            ],
            keywords: [
              "legislative workflow transparency",
              "Direct vs Partial bill links",
              "future bill review process",
            ],
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Legislative workflow transparency" },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Legislative workflow transparency"
          title="How EquityStack checks legislative bill links before they appear in public analysis."
          description="This page explains what the legislative workflow is supposed to do, what safeguards exist, and what the latest public-safe workflow reports currently say."
          actions={
            <>
              <Link href="/methodology" className="dashboard-button-primary">
                Read methodology
              </Link>
              <Link href="/bills" className="dashboard-button-secondary">
                Browse bills
              </Link>
            </>
          }
        />
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Current workflow status"
          title="Latest public-safe workflow check"
          description={data.statusMessage}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Workflow health"
            value={data.health.status}
            description={data.health.summary}
            tone={getStatusTone(data.health.status)}
          />
          <KpiCard
            label="Last pipeline run"
            value={data.health.pipelineStatus}
            description="This reflects whether the latest legislative pipeline report completed or failed before the canonical review bundle was rebuilt."
            tone={
              data.health.pipelineStatus === "Failed"
                ? "danger"
                : data.health.pipelineStatus === "Succeeded"
                  ? "success"
                  : "warning"
            }
          />
          <KpiCard
            label="Review-needed cases"
            value={data.health.manualReviewCount}
            description="These are the currently uncertain cases that still need a human check."
            tone={data.health.manualReviewCount > 0 ? "warning" : "success"}
          />
          <KpiCard
            label="Approved pending apply"
            value={data.health.approvedPendingCount}
            description="These updates have already been reviewed and are waiting for the guarded apply stage."
            tone={data.health.approvedPendingCount > 0 ? "info" : "default"}
          />
          <KpiCard
            label="AI-safe pending apply"
            value={data.health.aiApprovedPendingCount}
            description="This is the subset of apply-ready actions that came from the limited safe auto-triage path."
            tone={data.health.aiApprovedPendingCount > 0 ? "info" : "default"}
          />
          <KpiCard
            label="Anomaly status"
            value={data.anomaly.status}
            description={data.anomaly.summary}
            tone={getStatusTone(data.anomaly.status)}
          />
        </div>

        <Panel padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={getStatusTone(data.status)}>
              Overall status: {data.status}
            </StatusPill>
            <StatusPill tone={data.health.repairRecommended ? "warning" : "default"}>
              Repair recommended: {formatYesNo(data.health.repairRecommended)}
            </StatusPill>
            <StatusPill tone={data.anomaly.flagCount > 0 ? "warning" : "default"}>
              Anomaly flags: {data.anomaly.flagCount}
            </StatusPill>
          </div>
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            Latest public-safe status timestamp: {formatTimestamp(data.generatedAt)}.
            This page summarizes workflow health without exposing operator payloads,
            internal artifact paths, or admin controls.
          </p>
        </Panel>
      </section>

      <TrustBar />

      <section className="grid gap-6 border-t border-[var(--line)] pt-6 md:grid-cols-2">
        <div className="space-y-4">
          <SectionIntro
            eyebrow="What the workflow does"
            title="It is a legislative link-checking workflow, not a public opinion tool."
            description="The legislative workflow exists to keep public legislative relationships cleaner, narrower, and easier to defend."
          />
          <div className="space-y-4">
            {WORKFLOW_DOES.map((item) => (
              <Panel key={item.title} padding="md">
                <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {item.body}
                </p>
              </Panel>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <SectionIntro
            eyebrow="What it does not do"
            title="It does not turn legislative procedure into a complete impact judgment."
            description="The workflow helps manage link quality and review state. It is not the site’s final word on substantive Black-impact outcomes."
          />
          <div className="space-y-4">
            {WORKFLOW_DOES_NOT.map((item) => (
              <Panel key={item.title} padding="md">
                <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {item.body}
                </p>
              </Panel>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-[var(--line)] pt-6">
        <SectionIntro
          eyebrow="Safeguards"
          title="How the workflow tries to stay conservative"
          description="These review layers exist so strong public link labels are earned, uncertain cases stay visible as uncertain, and stale state can be repaired instead of silently drifting."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SAFEGUARDS.map((item) => (
            <Panel key={item.title} padding="md" className="h-full">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {item.body}
              </p>
            </Panel>
          ))}
        </div>
      </section>

      <section className="space-y-4 border-t border-[var(--line)] pt-6">
        <SectionIntro
          eyebrow="How to read the data"
          title="Direct, Partial, and review-needed mean different things"
          description="These relationship labels describe how confidently the workflow can connect a future policy idea to a tracked bill. They do not replace the underlying policy, bill, and source context."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {LINK_TYPES.map((item) => (
            <Panel key={item.title} padding="md" className="h-full">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {item.body}
              </p>
            </Panel>
          ))}
        </div>
        <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Procedural outcomes are limited
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
            Legislative outcomes can show whether a bill advanced, stalled, or passed.
            They should not be read as a complete substitute for downstream impact analysis
            on policy pages, reports, or source-backed explainers.
          </p>
        </Panel>
      </section>

      <CitationNote
        title="Public-safe transparency note"
        description="This page summarizes workflow status in plain English. It intentionally omits admin approvals, raw review payloads, stack traces, internal filesystem paths, and internal network details."
      />

      <section className="space-y-4 border-t border-[var(--line)] pt-6">
        <SectionIntro
          eyebrow="Limits and caveats"
          title="What this page cannot settle by itself"
          description="Transparency about the workflow is useful, but it is still narrower than a complete public-policy interpretation layer."
        />
        <div className="grid gap-3">
          {LIMITS.map((item) => (
            <Panel key={item} padding="md">
              <p className="text-sm leading-7 text-[var(--ink-soft)]">{item}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section className="space-y-4 border-t border-[var(--line)] pt-6">
        <SectionIntro
          eyebrow="Related methodology links"
          title="Where to go next"
          description="Use these pages when you want the broader methodology, the public bill records, the future-policy side of the workflow, or the underlying source library."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {RELATED_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="panel-link p-4">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
