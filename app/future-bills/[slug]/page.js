import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/app/components/public/chrome";
import StructuredData from "@/app/components/public/StructuredData";
import HelpfulFeedback from "@/app/components/feedback/HelpfulFeedback";
import TrackedLink from "@/app/components/telemetry/TrackedLink";
import CopyShareLinkButton from "@/app/reports/black-impact-score/CopyShareLinkButton";
import {
  CitationNote,
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
} from "@/app/components/public/core";
import {
  FutureBillDetailSections,
  formatDate,
  priorityClasses,
  statusClasses,
} from "@/app/future-bills/FutureBillContent";
import { countLabel, isThinText, sentenceJoin } from "@/lib/editorial-depth";
import { buildPageMetadata } from "@/lib/metadata";
import { getFutureBillDetail } from "@/lib/shareable-cards";
import {
  buildBreadcrumbJsonLd,
  buildLegislationJsonLd,
} from "@/lib/structured-data";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const bill = await getFutureBillDetail(slug);

  if (!bill) {
    return buildPageMetadata({
      title: "Future Bill Not Found",
      description: "The requested future bill could not be found on EquityStack.",
      path: `/future-bills/${slug}`,
    });
  }

  const title = bill.title;
  const description =
    bill.summary ||
    "A standalone EquityStack future bill page with linked legislation, sponsors, updates, explainers, and source links.";
  return buildPageMetadata({
    title,
    description,
    path: bill.detailPath,
    imagePath: `${bill.cardPath}/opengraph-image`,
    type: "article",
    keywords: [
      bill.target_area,
      "future legislation affecting Black Americans",
      "reform proposal",
    ].filter(Boolean),
  });
}

function MetaPill({ children }) {
  return (
    <span className="public-pill">
      {children}
    </span>
  );
}

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="card-muted rounded-[1.2rem] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{title}</p>
      <p className="text-lg font-semibold mt-2">{value}</p>
      {subtitle ? <p className="text-sm text-[var(--ink-soft)] mt-2">{subtitle}</p> : null}
    </div>
  );
}

function buildFutureBillOverview(bill) {
  return sentenceJoin([
    bill.target_area
      ? `${bill.title} is grouped under ${bill.target_area.toLowerCase()} in the public reform pipeline.`
      : `${bill.title} is tracked here as a future-facing reform proposal.`,
    `${countLabel((bill.tracked_bills || []).length, "linked bill")} and ${countLabel(
      (bill.related_explainers || []).length,
      "linked explainer"
    )} currently provide surrounding context.`,
    `${countLabel(
      (bill.sources || []).length,
      "public source"
    )} are visible in the current detail view.`,
  ]);
}

function buildFutureBillGuideCards(bill) {
  const thinLead =
    isThinText(bill.summary, 140) && isThinText(bill.problem_statement, 180);

  return [
    {
      eyebrow: "What this page tracks",
      title: "A proposal, not a settled law",
      description:
        "Future-bill pages keep the problem statement, proposed solution, tracked legislative movement, and surrounding historical context in one place without treating the proposal as already enacted.",
    },
    {
      eyebrow: "How to use it",
      title: "Read the problem, solution, and linked legislative trail together",
      description:
        "Start with the problem statement and proposed solution, then compare the linked bills, explainers, and sponsor context before treating the proposal as a likely outcome.",
    },
    {
      eyebrow: "Coverage note",
      title: thinLead ? "This proposal still depends on linked context" : "Use the proposal page as an early research path",
      description: thinLead
        ? sentenceJoin([
            buildFutureBillOverview(bill),
            "Proposal pages can still be thin when the legislative record is early, so the linked bills, explainers, and sources matter more than one short lead paragraph.",
          ])
        : "Even when the summary is stronger, this page is best used together with the linked bills, sources, and explainers rather than as a standalone prediction.",
    },
  ];
}

export default async function FutureBillDetailPage({ params }) {
  const { slug } = await params;
  const bill = await getFutureBillDetail(slug);

  if (!bill) {
    notFound();
  }

  const guideCards = buildFutureBillGuideCards(bill);
  const thinSummary = isThinText(bill.summary, 140);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/future-bills", label: "Future Bills" },
              { label: bill.title },
            ],
            bill.detailPath
          ),
          buildLegislationJsonLd({
            title: bill.title,
            description: bill.summary,
            path: bill.detailPath,
            identifier: bill.slug,
            imagePath: `${bill.cardPath}/opengraph-image`,
            dateCreated: bill.created_at,
            dateModified: bill.latest_tracked_update,
            about: [
              bill.target_area,
              "reform proposal",
              "future legislation affecting Black Americans",
            ],
            keywords: [
              bill.target_area,
              "future legislation affecting Black Americans",
              "reform proposal",
            ].filter(Boolean),
            legislationType: "Future bill",
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/future-bills", label: "Future Bills" },
          { label: bill.title },
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/future-bills"
          className="dashboard-button-secondary"
        >
          Back to Future Bills
        </Link>
        <TrackedLink
          href={bill.cardPath}
          eventType="share_card_click"
          routeKind="detail"
          entityType="future-bill"
          entityKey={bill.slug}
          className="dashboard-button-secondary"
        >
          Open Card Page
        </TrackedLink>
      </div>

      <section className="hero-panel p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-4xl">
            <p className="eyebrow mb-4">{bill.target_area || "Future Bill"}</p>
            <h1 className="page-title">{bill.title}</h1>
            <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8">
              {bill.summary}
            </p>
            {thinSummary ? (
              <p className="text-sm leading-7 text-[var(--ink-soft)] mt-4">
                {buildFutureBillOverview(bill)}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-4">
              <span className={`status-pill ${priorityClasses(bill.priority_level)}`}>
                {bill.priority_level}
              </span>
              <span className={`status-pill ${statusClasses(bill.status)}`}>
                {bill.status}
              </span>
              <MetaPill>{bill.tracked_bills.length} linked bills</MetaPill>
              <MetaPill>{bill.related_explainers?.length || 0} explainers</MetaPill>
              {bill.created_at ? <MetaPill>Added {formatDate(bill.created_at)}</MetaPill> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <TrackedLink
              href={bill.cardPath}
              eventType="share_card_click"
              routeKind="detail"
              entityType="future-bill"
              entityKey={bill.slug}
              className="dashboard-button-secondary"
            >
              Share Card
            </TrackedLink>
            <CopyShareLinkButton
              path={bill.detailPath}
              defaultLabel="Copy Page Link"
              copiedLabel="Copied!"
              trackPayload={{
                route_kind: "detail",
                entity_type: "future-bill",
                entity_key: bill.slug,
              }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Topic"
          value={bill.target_area || "Not specified"}
          subtitle="The main issue area this future bill targets."
        />
        <SummaryCard
          title="Latest Bill Update"
          value={formatDate(bill.latest_tracked_update) || "No recent update"}
          subtitle={bill.latest_action_summary?.text || "No linked legislative action is recorded yet."}
        />
        <SummaryCard
          title="Sponsors and Scorecards"
          value={String(bill.linked_legislators?.length || 0)}
          subtitle="Linked legislators with scorecard records connected to this proposal."
        />
        <SummaryCard
          title="Verification"
          value={String(bill.sources?.length || 0)}
          subtitle="Public source links pulled from linked bills and tracked actions."
        />
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          description="This page is the detail view for one future bill or reform proposal. It brings together the problem statement, proposed solution, linked bills, explainers, and sponsor context already present in EquityStack."
          detail="Use it when you want to understand what the proposal is trying to change, how much supporting legislative context is already linked, and where to continue the research path."
        />
        <div className="rounded-[1.6rem] border border-[rgba(132,247,198,0.18)] bg-[linear-gradient(145deg,rgba(14,36,33,0.72),rgba(8,14,24,0.96))] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Why this proposal matters
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">A forward-looking policy record</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
            Future-bill pages help search visitors understand reform ideas before they become settled law. They connect unresolved harms, proposed solutions, live legislative tracking, and surrounding context without pretending the proposal is already implemented.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {guideCards.map((item) => (
          <div
            key={item.title}
            className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              {item.eyebrow}
            </p>
            <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/bills" className="panel-link p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            Legislative tracking
          </p>
          <h2 className="mt-3 text-lg font-semibold text-white">Browse linked bills and current movement</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Open the bill tracker when you want current congressional status, bill-level impact estimates, and deeper legislative timelines.
          </p>
        </Link>
        <Link href="/explainers" className="panel-link p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            Historical context
          </p>
          <h2 className="mt-3 text-lg font-semibold text-white">Read explainers tied to the same reform area</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Explainers help place this proposal inside the longer history of Black policy impact, legal change, and unfinished reform.
          </p>
        </Link>
        <div className="space-y-4">
          <MethodologyCallout
            title="How to read future-bill pages"
            description="Proposal pages surface reform direction and linked context, but they remain limited by the current public legislative and source record."
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.7rem] p-7 md:p-8">
        <FutureBillDetailSections bill={bill} detailMode sources={bill.sources} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <CitationNote
          title="How to cite this proposal page"
          description="When referencing a future-bill page externally, cite the proposal title, EquityStack, the page URL, and your access date. Treat the page as a tracked reform record built from linked bills, sources, and contextual explainers rather than a prediction that the proposal will pass."
        />
        <MethodologyCallout
          title="How to read proposal-stage records"
          description="Proposal pages show direction, problem framing, and linked legislative context, but they can remain thinner than enacted-law pages while a bill is still in idea, drafting, advocacy, or introduced status."
          linkLabel="Review methodology and limits"
        />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Continue into legislation, explainers, reports, and trust pages"
          description="Proposal pages work best when they lead outward into the bill tracker, historical context, analytical summaries, and the trust pages that explain how EquityStack organizes the record."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/bills" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Bill tracker
            </p>
            <h2 className="mt-3 text-lg font-semibold text-white">Browse linked legislation and enacted bills</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Move from proposal language into current or historical legislation when you need chamber activity, sponsor history, and bill-level impact context.
            </p>
          </Link>
          <Link href="/explainers" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Historical context
            </p>
            <h2 className="mt-3 text-lg font-semibold text-white">Read explainers tied to the same reform area</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use explainers when the proposal depends on longer histories of rights, exclusion, enforcement, or unfinished policy repair.
            </p>
          </Link>
          <Link href="/reports" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Reports
            </p>
            <h2 className="mt-3 text-lg font-semibold text-white">Read report analysis before comparing proposals</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Reports help place one proposal inside larger patterns across administrations, issue areas, and tracked outcomes.
            </p>
          </Link>
          <Link href="/research" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Research hub
            </p>
            <h2 className="mt-3 text-lg font-semibold text-white">Return to the curated research hub</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the research hub when this proposal leads into a larger question about presidents, policy pathways, explainers, or public methodology.
            </p>
          </Link>
        </div>
      </section>

      <HelpfulFeedback
        pagePath={bill.detailPath}
        routeKind="detail"
        entityType="future-bill"
        entityKey={bill.slug}
      />
    </main>
  );
}
