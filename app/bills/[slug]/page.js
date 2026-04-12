import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  MethodologyCallout,
  PageContextBlock,
  ScoreBadge,
  SectionIntro,
} from "@/app/components/public/core";
import StructuredData from "@/app/components/public/StructuredData";
import {
  EvidenceSourceList,
  PolicyTimeline,
} from "@/app/components/public/entities";
import { ImpactBadge, statusPillClasses } from "@/app/components/policy-badges";
import { buildPageMetadata } from "@/lib/metadata";
import {
  buildPublicBillsDataset,
  formatBillDate,
  formatRelationshipTypeLabel,
  getBillBySlug,
  getRelatedBillsForSlug,
} from "@/lib/public-bills";
import { getFutureBills } from "@/lib/shareable-cards";
import {
  buildBreadcrumbJsonLd,
  buildLegislationJsonLd,
} from "@/lib/structured-data";

async function getBillPageData(slug) {
  const futureBills = await getFutureBills();
  const bills = buildPublicBillsDataset(futureBills);
  return {
    bill: getBillBySlug(slug, bills),
    relatedBills: getRelatedBillsForSlug(slug, bills, 4),
  };
}

async function getBillDetail(slug) {
  const { bill } = await getBillPageData(slug);
  return bill;
}

function buildBillDescription(bill) {
  return bill.officialSummary || bill.whyItMatters;
}

function MetaPill({ children }) {
  return <span className="public-pill">{children}</span>;
}

function SummaryPanel({ label, children }) {
  return (
    <div className="rounded-[1.35rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ink-muted)]">
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DetailLine({ label, value }) {
  return (
    <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{value || "—"}</p>
    </div>
  );
}

function ContextTag({ children }) {
  return <span className="public-pill">{children}</span>;
}

function RelatedPromiseCard({ item }) {
  return (
    <Link
      href={item.href}
      className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4 hover:border-[rgba(132,247,198,0.24)]"
    >
      <p className="font-medium text-white">{item.title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ContextTag>{formatRelationshipTypeLabel(item.relationshipType)}</ContextTag>
        <ContextTag>{item.matchConfidence} confidence</ContextTag>
        {item.presidentName ? <ContextTag>{item.presidentName}</ContextTag> : null}
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
        {item.summary || item.topic || "Open the linked promise for broader public context."}
      </p>
    </Link>
  );
}

function RelatedPresidentCard({ item }) {
  return (
    <Link
      href={item.href}
      className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4 hover:border-[rgba(132,247,198,0.24)]"
    >
      <p className="font-medium text-white">{item.name}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ContextTag>{formatRelationshipTypeLabel(item.relationshipType)}</ContextTag>
        <ContextTag>{item.matchConfidence} confidence</ContextTag>
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
        {item.relationshipType === "promise_link"
          ? "Connected through one or more promises already linked to this bill’s public reform context."
          : "Connected through related policy lineage already attached to the bill’s current public context."}
      </p>
    </Link>
  );
}

function ImpactBreakdownRow({ item }) {
  const value = Number(item.value || 0);
  const width = Math.min(Math.abs(value) * 4, 100);
  const toneClass =
    value > 0
      ? "bg-[rgba(132,247,198,0.55)]"
      : value < 0
        ? "bg-[rgba(255,138,138,0.55)]"
        : "bg-white/15";

  return (
    <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">{item.label}</p>
        <p className="text-sm font-semibold text-[var(--ink-soft)]">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
    </div>
  );
}

function RelatedBillCard({ bill }) {
  return (
    <Link href={bill.detailHref} className="panel-link flex h-full min-w-0 flex-col rounded-[1.4rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            {bill.billNumber}
          </p>
          <h3 className="mt-3 line-clamp-2 text-lg font-semibold text-white">{bill.title}</h3>
        </div>
        <ScoreBadge
          value={String(bill.blackImpactScore)}
          label="BIS"
          tone={
            bill.impactDirection === "Positive"
              ? "positive"
              : bill.impactDirection === "Negative"
                ? "negative"
                : "default"
          }
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ImpactBadge impact={bill.impactDirection} />
        <span className={statusPillClasses(bill.statusTone)}>{bill.status}</span>
        {bill.relatedTopicOverlap?.map((topic) => (
          <span key={`${bill.id}-${topic}`} className="public-pill">
            {topic}
          </span>
        ))}
      </div>
      <p className="mt-4 line-clamp-4 text-sm leading-7 text-[var(--ink-soft)]">
        {bill.whyItMatters}
      </p>
    </Link>
  );
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const bill = await getBillDetail(slug);

  if (!bill) {
    return buildPageMetadata({
      title: "Bill Not Found",
      description: "The requested bill could not be found in the public legislative tracker.",
      path: `/bills/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${bill.billNumber} | ${bill.title}`,
    description: buildBillDescription(bill),
    path: bill.detailHref,
    type: "article",
    keywords: [
      bill.billNumber,
      ...bill.topicTags,
      "legislation affecting Black Americans",
    ].filter(Boolean),
  });
}

export default async function BillDetailPage({ params }) {
  const { slug } = await params;
  const { bill, relatedBills } = await getBillPageData(slug);

  if (!bill) {
    notFound();
  }

  return (
    <main className="space-y-10">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/bills", label: "Bills" },
              { label: bill.title },
            ],
            bill.detailHref
          ),
          buildLegislationJsonLd({
            title: bill.title,
            description: buildBillDescription(bill),
            path: bill.detailHref,
            identifier: bill.billNumber,
            dateCreated: bill.introducedDate,
            dateModified: bill.latestActionDate,
            about: [
              "Congress",
              "civil rights policy",
              "Black Americans",
              ...bill.topicTags,
            ],
            keywords: [
              bill.billNumber,
              ...bill.topicTags,
              "legislation affecting Black Americans",
            ],
            legislationType: bill.chamber,
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/bills", label: "Bills" },
          { label: bill.title },
        ]}
      />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-4xl">
            <p className="eyebrow mb-4">{bill.billNumber}</p>
            <h1 className="page-title">{bill.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--ink-soft)] md:text-lg">
              {buildBillDescription(bill)}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className={statusPillClasses(bill.statusTone)}>{bill.status}</span>
              <ImpactBadge impact={bill.impactDirection} />
              <span className={statusPillClasses(bill.confidenceTone)}>
                Impact confidence: {bill.impactConfidence}
              </span>
              <span className={statusPillClasses(bill.reviewTone)}>{bill.reviewProxy}</span>
              {bill.topicTags.map((topic) => (
                <MetaPill key={`${bill.id}-${topic}`}>{topic}</MetaPill>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/bills" className="public-button-secondary">
              Back to bills
            </Link>
            <Link href={bill.primaryContextHref} className="public-button-secondary">
              Open bill context
            </Link>
            <a
              href={bill.congressUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="public-button-secondary"
            >
              View on Congress.gov
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SummaryPanel label="Impact panel">
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div>
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                EquityStack estimates a bill-level Black Impact Score from domain relevance, population reach, enforcement strength, legislative progress, risk signals, and source-backed confidence.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ImpactBadge impact={bill.impactDirection} />
                <MetaPill>Confidence {bill.impactConfidence}</MetaPill>
                <MetaPill>Last action {formatBillDate(bill.latestActionDate) || "Unavailable"}</MetaPill>
              </div>
            </div>
            <ScoreBadge
              value={String(bill.blackImpactScore)}
              label="Estimated Black Impact Score"
              tone={
                bill.impactDirection === "Positive"
                  ? "positive"
                  : bill.impactDirection === "Negative"
                    ? "negative"
                    : "default"
              }
              size="lg"
            />
          </div>
        </SummaryPanel>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailLine label="Review status" value={bill.reviewProxy} />
          <DetailLine label="Source count" value={String(bill.sourceCount || 0)} />
          <DetailLine label="Linked reform concepts" value={String(bill.linkedFutureBills.length || 0)} />
          <DetailLine label="Tracked sponsors" value={String(bill.sponsorCount || 0)} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <SectionIntro
            eyebrow="Why this matters"
            title="Why EquityStack is surfacing this bill"
            description="The goal here is to make the legislative layer readable: why the bill matters, what it is connected to, and how far the public record goes right now."
          />
          <p className="mt-5 text-sm leading-8 text-[var(--ink-soft)]">{bill.whyItMatters}</p>
        </div>

        <PageContextBlock
          title="What this page can and cannot tell you"
          description="This is a public bill detail page built from tracked bill records, actions, sponsors, and linked future-bill context already in EquityStack."
          detail="The bill BIS model is deterministic and explainable, but still limited by the public tracked-bill dataset. Missing source depth or thin legislative context can keep a bill closer to mixed or low-confidence readings."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Legislative details"
            title="Current bill record"
            description="This section stays close to the tracked legislative fields already exposed publicly."
          />
          <div className="grid gap-4">
            <DetailLine label="Congress" value={bill.sessionLabel || "Not surfaced"} />
            <DetailLine label="Chamber" value={bill.chamber || "Not surfaced"} />
            <DetailLine label="Sponsor" value={bill.sponsor || "Not surfaced"} />
            <DetailLine label="Jurisdiction" value={bill.jurisdiction || "Not surfaced"} />
            <DetailLine label="Introduced" value={formatBillDate(bill.introducedDate) || "Not surfaced"} />
            <DetailLine label="Latest action" value={bill.latestAction || "No public action text yet"} />
          </div>
        </div>

        <div className="space-y-5">
          <SectionIntro
            eyebrow="Timeline"
            title="Status progression"
            description="This timeline is built from the tracked action history already attached to the bill record."
          />
          <PolicyTimeline items={bill.timeline} />
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Impact breakdown"
          title="Score breakdown"
          description="These components roll up into the bill's Estimated Black Impact Score and stay visible so the score remains inspectable."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {bill.impactBreakdownItems.map((item) => (
            <ImpactBreakdownRow key={item.key} item={item} />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Related context"
          title="What this bill connects to today"
          description="This section only surfaces joins supported by existing explainer, policy, promise, and president lineage already modeled in EquityStack."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[1.4rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h3 className="text-lg font-semibold text-white">Related promises</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Promise links are only surfaced when the bill reaches a promise through existing explainer context or policy lineage already stored in the repo.
            </p>
            <div className="mt-4 grid gap-3">
              {bill.relatedPromises.length ? (
                bill.relatedPromises.slice(0, 4).map((item) => (
                  <RelatedPromiseCard key={item.id || item.slug || item.title} item={item} />
                ))
              ) : (
                <div className="rounded-[1.1rem] border border-dashed border-white/12 bg-white/4 px-4 py-4 text-sm leading-7 text-[var(--ink-soft)]">
                  No supported promise joins are linked to this bill yet.
                </div>
              )}
            </div>
            {!bill.relatedPromises.length ? (
              <Link href="/promises" className="mt-4 inline-flex text-sm font-medium text-[var(--accent)] hover:text-white">
                Open Promise Tracker
              </Link>
            ) : null}
          </div>
          <div className="rounded-[1.4rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h3 className="text-lg font-semibold text-white">Related presidents</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Presidential context is derived from linked promises first, then from connected policy lineage when no stronger promise path is available.
            </p>
            <div className="mt-4 grid gap-3">
              {bill.relatedPresidents.length ? (
                bill.relatedPresidents.map((item) => (
                  <RelatedPresidentCard key={item.slug || item.name} item={item} />
                ))
              ) : (
                <div className="rounded-[1.1rem] border border-dashed border-white/12 bg-white/4 px-4 py-4 text-sm leading-7 text-[var(--ink-soft)]">
                  No supported presidential joins are linked to this bill yet.
                </div>
              )}
            </div>
            {!bill.relatedPresidents.length ? (
              <Link href="/presidents" className="mt-4 inline-flex text-sm font-medium text-[var(--accent)] hover:text-white">
                Browse presidents
              </Link>
            ) : null}
          </div>
          <div className="rounded-[1.4rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h3 className="text-lg font-semibold text-white">Related policy history</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              EquityStack surfaces policy-history context here through linked policy records, future-bill concepts, and explainers already attached to this bill’s public context.
            </p>
            <div className="mt-4 grid gap-3">
              {bill.policyHistoryItems.length ? (
                bill.policyHistoryItems.map((item) => (
                  <Link
                    key={`${item.kind}-${item.title}`}
                    href={item.href}
                    className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4 hover:border-[rgba(132,247,198,0.24)]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                      {item.kind}
                    </p>
                    <p className="mt-2 font-medium text-white">{item.title}</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{item.summary}</p>
                  </Link>
                ))
              ) : (
                <div className="rounded-[1.1rem] border border-dashed border-white/12 bg-white/4 px-4 py-4 text-sm leading-7 text-[var(--ink-soft)]">
                  No policy-history context is linked to this bill yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Related bills"
          title="Bills with nearby public context"
          description="Related bills are derived from shared domains and policy areas first, then refined by topic overlap, chamber, status, and current impact direction."
        />
        {relatedBills.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {relatedBills.map((item) => (
              <RelatedBillCard key={item.slug} bill={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
            No related bills share enough topic overlap to surface here yet.
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Sources"
            title={`${bill.sourceCount} source${bill.sourceCount === 1 ? "" : "s"} linked to this bill`}
            description="Sources come from the tracked bill record itself plus the public action-history links attached to it."
          />
          {bill.sources.length ? (
            <EvidenceSourceList items={bill.sources} />
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
              No public source links are attached to this bill yet.
            </div>
          )}
        </div>

        <div className="space-y-5">
          <MethodologyCallout
            title="Why the bill detail page is cautious"
            description="This page is designed to help users inspect tracked legislation without pretending the bill layer is more complete than it is. Source links, impact confidence, and the BIS breakdown stay visible so uncertainty is not hidden."
            href="/methodology"
            linkLabel="Open methodology"
          />

          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h2 className="text-lg font-semibold text-white">External record</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Congress.gov remains the fastest external verification surface for the bill text, actions, and broader legislative record.
            </p>
            <a
              href={bill.congressUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium text-white hover:border-white/20 hover:bg-white/6"
            >
              Open Congress.gov
            </a>
          </div>

          {bill.linkedLegislators.length ? (
            <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
              <h2 className="text-lg font-semibold text-white">Linked scorecards</h2>
              <div className="mt-4 grid gap-3">
                {bill.linkedLegislators.map((item) => (
                  <Link
                    key={item.id}
                    href={`/scorecards/${item.id}`}
                    className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4 hover:border-[rgba(132,247,198,0.24)]"
                  >
                    <p className="font-medium text-white">{item.full_name}</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      {[item.role, item.chamber, item.party, item.state].filter(Boolean).join(" • ")}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Move from this bill into broader legislative, policy, and research paths"
          description="Bill pages are strongest when they lead outward into the surrounding legal history, related records, and trust pages that help users verify what the bill record can and cannot show."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/analysis/civil-rights-laws-by-president" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Legislation lens
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Review civil-rights laws by president</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the legislation guide when this bill belongs in a longer administration-level legal history affecting Black Americans.
            </p>
          </Link>
          <Link href="/policies" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Policy explorer
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Compare the bill with policy records</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Move into policy records when you need laws, executive actions, or court decisions that sit next to this bill in the broader public record.
            </p>
          </Link>
          <Link href="/future-bills" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Reform proposals
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Browse related future bills and reform ideas</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the proposal layer when this bill opens into unresolved reform paths, newer proposals, or legislative follow-on context.
            </p>
          </Link>
          <Link href="/research" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Research hub
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Return to the curated research hub</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the research hub when this bill leads into a broader question about presidents, reports, explainers, methods, or historical comparison.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
