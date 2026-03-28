import Link from "next/link";
import { notFound } from "next/navigation";
import CopyShareLinkButton from "@/app/reports/black-impact-score/CopyShareLinkButton";
import {
  FutureBillDetailSections,
  formatDate,
  priorityClasses,
  statusClasses,
} from "@/app/future-bills/FutureBillContent";
import { buildPageMetadata } from "@/lib/metadata";
import { getFutureBillDetail } from "@/lib/shareable-cards";

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

  const title = `${bill.title} Future Bill`;
  const description =
    bill.summary ||
    "A standalone EquityStack future bill page with linked legislation, sponsors, updates, explainers, and source links.";
  const imageUrl = `${bill.cardPath}/opengraph-image`;

  return {
    title,
    description,
    alternates: {
      canonical: bill.detailPath,
    },
    openGraph: {
      title,
      description,
      url: bill.detailPath,
      type: "article",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: bill.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

function MetaPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-3 py-1 text-xs text-[var(--ink-soft)]">
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
      <div className="flex flex-wrap gap-3">
        <Link
          href="/future-bills"
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Back to Future Bills
        </Link>
        <Link
          href={bill.cardPath}
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          Open Shareable Card
        </Link>
      </div>

      <section className="hero-panel p-8 md:p-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-4xl">
            <p className="eyebrow mb-4">{bill.target_area || "Future Bill"}</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{bill.title}</h1>
            <p className="text-base md:text-lg text-[var(--ink-soft)] mt-4 leading-8">
              {bill.summary}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className={`border rounded-full px-3 py-1 text-xs font-medium ${priorityClasses(bill.priority_level)}`}>
                {bill.priority_level}
              </span>
              <span className={`border rounded-full px-3 py-1 text-xs font-medium ${statusClasses(bill.status)}`}>
                {bill.status}
              </span>
              <MetaPill>{bill.tracked_bills.length} linked bills</MetaPill>
              <MetaPill>{bill.related_explainers?.length || 0} explainers</MetaPill>
              {bill.created_at ? <MetaPill>Added {formatDate(bill.created_at)}</MetaPill> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={bill.cardPath}
              className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
            >
              Share Card
            </Link>
            <CopyShareLinkButton
              path={bill.detailPath}
              defaultLabel="Copy Page Link"
              copiedLabel="Copied!"
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
          subtitle="Public source links aggregated from linked bills and tracked actions."
        />
      </section>

      <section className="card-surface rounded-[1.7rem] p-7 md:p-8">
        <FutureBillDetailSections bill={bill} detailMode sources={bill.sources} />
      </section>
    </main>
  );
}
