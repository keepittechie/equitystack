import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/app/components/public/chrome";
import StructuredData from "@/app/components/public/StructuredData";
import HelpfulFeedback from "@/app/components/feedback/HelpfulFeedback";
import TrackedLink from "@/app/components/telemetry/TrackedLink";
import CopyShareLinkButton from "@/app/reports/black-impact-score/CopyShareLinkButton";
import {
  MethodologyCallout,
  PageContextBlock,
} from "@/app/components/public/core";
import {
  FutureBillDetailSections,
  formatDate,
  priorityClasses,
  statusClasses,
} from "@/app/future-bills/FutureBillContent";
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

export default async function FutureBillDetailPage({ params }) {
  const { slug } = await params;
  const bill = await getFutureBillDetail(slug);

  if (!bill) {
    notFound();
  }

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
          className="public-button-secondary"
        >
          Back to Future Bills
        </Link>
        <TrackedLink
          href={bill.cardPath}
          eventType="share_card_click"
          routeKind="detail"
          entityType="future-bill"
          entityKey={bill.slug}
          className="public-button-secondary"
        >
          Open Card Page
        </TrackedLink>
      </div>

      <section className="hero-panel p-8 md:p-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-4xl">
            <p className="eyebrow mb-4">{bill.target_area || "Future Bill"}</p>
            <h1 className="page-title">{bill.title}</h1>
            <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8">
              {bill.summary}
            </p>
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
              className="public-button-secondary"
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
        <Link href="/bills" className="panel-link rounded-[1.4rem] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            Legislative tracking
          </p>
          <h2 className="mt-3 text-lg font-semibold text-white">Browse linked bills and current movement</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Open the bill tracker when you want current congressional status, bill-level impact estimates, and deeper legislative timelines.
          </p>
        </Link>
        <Link href="/explainers" className="panel-link rounded-[1.4rem] p-5">
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

      <HelpfulFeedback
        pagePath={bill.detailPath}
        routeKind="detail"
        entityType="future-bill"
        entityKey={bill.slug}
      />
    </main>
  );
}
