import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchInternalJson } from "@/lib/api";
import { buildExplainerJsonLd, serializeJsonLd } from "@/lib/structured-data";

async function getExplainer(slug) {
  return fetchInternalJson(`/api/explainers/${slug}`, {
    allow404: true,
    errorMessage: "Failed to fetch explainer",
  });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const explainer = await getExplainer(slug);

  if (!explainer) {
    return {
      title: "Explainer Not Found | EquityStack",
      description: "The requested explainer could not be found on EquityStack.",
    };
  }

  return {
    title: `${explainer.title} | EquityStack`,
    description:
      explainer.summary ||
      "Evidence-backed historical and policy analysis from EquityStack.",
  };
}

function SectionBlock({ title, children }) {
  if (!children) return null;

  return (
    <section className="card-surface rounded-[1.6rem] p-6 space-y-3">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="text-[var(--ink-soft)] leading-8 whitespace-pre-line">{children}</div>
    </section>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="card-muted rounded-[1.15rem] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="text-xl font-semibold mt-2">{value}</p>
    </div>
  );
}

function priorityClasses(priority) {
  switch (priority) {
    case "Critical":
      return "bg-red-50 text-red-700 border-red-200";
    case "High":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Low":
      return "bg-stone-100 text-stone-700 border-stone-300";
    default:
      return "bg-stone-100 text-stone-700 border-stone-300";
  }
}

function parseLines(text) {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseTimeline(text) {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [year, ...rest] = line.split("|");
      return {
        year: year?.trim() || "",
        event: rest.join("|").trim() || line,
      };
    });
}

function formatSourceDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatImpactMetric(value) {
  return Number(value || 0).toFixed(2);
}

function getRelatedExplainers(slug) {
  const map = {
    "equal-protection-under-the-law": [
      {
        slug: "party-switch-southern-strategy",
        title: "Party Switch and the Southern Strategy",
      },
      {
        slug: "redlining-black-homeownership",
        title: "Redlining and Black Homeownership",
      },
      {
        slug: "sentencing-disparities-united-states",
        title: "Sentencing Disparities in the United States",
      },
    ],

    "redlining-black-homeownership": [
      {
        slug: "homestead-act-exclusion",
        title: "The Homestead Act and Unequal Access to Land",
      },
      {
        slug: "gi-bill-access-and-impact",
        title: "The GI Bill: Opportunity, Access, and Unequal Outcomes",
      },
      {
        slug: "bootstraps-vs-policy-reality",
        title: "“Pull Yourself Up by Your Bootstraps” vs. Policy Reality",
      },
    ],

    "crime-statistics-context-and-misuse": [
      {
        slug: "sentencing-disparities-united-states",
        title: "Sentencing Disparities in the United States",
      },
      {
        slug: "mass-incarceration-policy-history",
        title: "Mass Incarceration in the United States",
      },
    ],
  };

  return map[slug] || [];
}

export default async function ExplainerDetailPage({ params }) {
  const { slug } = await params;
  const explainer = await getExplainer(slug);

  if (!explainer) {
    notFound();
  }

  const takeaways = parseLines(explainer.key_takeaways);
  const timeline = parseTimeline(explainer.timeline_events);
  const relatedExplainers = getRelatedExplainers(slug);
  const sourceCount = explainer.sources?.length || 0;
  const policyCount = explainer.related_policies?.length || 0;
  const futureBillCount = explainer.related_future_bills?.length || 0;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildExplainerJsonLd(explainer)),
        }}
      />
      <div className="space-y-3">
        <Link
          href="/explainers"
          className="text-sm text-[var(--ink-soft)] hover:text-[var(--accent)] underline"
        >
          Back to Explainers
        </Link>
      </div>

      <section className="hero-panel p-8 md:p-10 space-y-6">
        <div>
          <p className="eyebrow mb-4">{explainer.category || "Explainer"}</p>
          <h1 className="text-4xl font-bold">{explainer.title}</h1>
          {explainer.summary && (
            <p className="text-lg text-[var(--ink-soft)] leading-8 mt-4">{explainer.summary}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MiniStat label="Linked Policies" value={policyCount} />
          <MiniStat label="Tracked Bills" value={futureBillCount} />
          <MiniStat label="Sources" value={sourceCount} />
        </div>
      </section>

      <section className="card-muted rounded-[1.5rem] p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
              Read This For
            </p>
            <p className="text-sm text-[var(--ink-soft)] leading-6 mt-2">
              A fast orientation to the claim, the record behind it, and the evidence trail.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
              Use It With
            </p>
            <p className="text-sm text-[var(--ink-soft)] leading-6 mt-2">
              The linked policy pages, timeline sections, and future-bill records below.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
              Best Next Step
            </p>
            <p className="text-sm text-[var(--ink-soft)] leading-6 mt-2">
              Open the linked records after each section rather than treating the explainer as the last stop.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.85fr)] items-start">
        <div className="space-y-6">
          {takeaways.length > 0 && (
            <section className="card-surface rounded-[1.6rem] p-6 space-y-3">
              <h2 className="text-2xl font-semibold">Key Takeaways</h2>
              <ul className="list-disc pl-6 space-y-2 text-[var(--ink-soft)]">
                {takeaways.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <SectionBlock title="Introduction">{explainer.intro_text}</SectionBlock>
          <SectionBlock title="Why This Matters">{explainer.why_it_matters}</SectionBlock>
          <SectionBlock title="The Common Claim">{explainer.common_claim}</SectionBlock>
          <SectionBlock title="What Actually Happened">
            {explainer.what_actually_happened}
          </SectionBlock>
          <SectionBlock title="Key Policies and Events">
            {explainer.key_policies_text}
          </SectionBlock>
          <SectionBlock title="Why It Still Matters">
            {explainer.why_it_still_matters}
          </SectionBlock>
        </div>

        <aside className="space-y-6">
          {timeline.length > 0 && (
            <section className="card-surface rounded-[1.6rem] p-6 space-y-4">
              <h2 className="text-2xl font-semibold">Timeline</h2>
              <div className="space-y-3">
                {timeline.map((item, index) => (
                  <div
                    key={`${item.year}-${index}`}
                    className="card-muted rounded-[1.1rem] p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--accent)]">{item.year}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-2 leading-6">{item.event}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card-surface rounded-[1.6rem] p-6 space-y-4">
            <h2 className="text-2xl font-semibold">Next Steps</h2>
            <div className="space-y-3 text-sm">
              <Link href="/policies" className="panel-link block rounded-xl p-3">
                Browse the full policy database
              </Link>
              <Link href="/timeline" className="panel-link block rounded-xl p-3">
                Place this story on the timeline
              </Link>
              <Link href="/future-bills" className="panel-link block rounded-xl p-3">
                See current reform proposals linked to this topic
              </Link>
            </div>
          </section>
        </aside>
      </div>

      {explainer.sources_note && (
        <SectionBlock title="Sources Note">{explainer.sources_note}</SectionBlock>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Related Policies</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-1">
              Open the primary record layer behind this explainer.
            </p>
          </div>
          <Link href="/policies" className="text-sm accent-link">
            Browse all policies
          </Link>
        </div>

        {explainer.related_policies?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {explainer.related_policies.map((policy) => (
              <Link
                key={policy.id}
                href={`/policies/${policy.id}`}
                className="panel-link block rounded-[1.35rem] p-4"
              >
                <h3 className="font-semibold">{policy.title}</h3>
                <p className="text-sm text-[var(--ink-soft)] mt-1">
                  {policy.year_enacted} {" • "} {policy.policy_type || "Policy"} {" • "}{" "}
                  {policy.primary_party || "Unknown party"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[var(--ink-soft)]">No related policies linked yet.</p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Current Reform Connections</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-1">
              Bills and legislators connected to the issue area this explainer is tracking.
            </p>
          </div>
          <Link href="/future-bills" className="text-sm accent-link">
            Open future bills
          </Link>
        </div>

        {explainer.related_future_bills?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {explainer.related_future_bills.map((bill) => (
              <div
                key={bill.id}
                className="card-surface rounded-[1.35rem] p-4"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold">{bill.title}</h3>
                  <span
                    className={`border rounded-full px-3 py-1 text-xs font-medium ${priorityClasses(
                      bill.priority_level
                    )}`}
                  >
                    {bill.priority_level}
                  </span>
                </div>

                <p className="text-sm text-[var(--ink-soft)] mt-2">
                  {bill.target_area || "No target area"} {" • "} {bill.status}
                </p>

                <p className="mt-2 text-sm text-[var(--ink-soft)] line-clamp-3">
                  {bill.problem_statement}
                </p>

                {bill.tracked_bills?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                      Related Real Bills
                    </p>

                    {bill.tracked_bills.map((trackedBill) => (
                      <div
                        key={trackedBill.id}
                        className="card-muted rounded-xl p-3"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {trackedBill.bill_number}
                          </span>
                          <span className="text-xs text-[var(--ink-soft)]">
                            {trackedBill.bill_status}
                          </span>
                        </div>

                        <p className="text-sm text-[var(--ink-soft)] mt-1">
                          {trackedBill.title}
                        </p>

                        {(trackedBill.sponsor_name || trackedBill.sponsor_party) && (
                          <p className="text-xs text-[var(--ink-soft)] mt-1">
                            {trackedBill.sponsor_name || "Unknown sponsor"}
                            {trackedBill.sponsor_party ? ` (${trackedBill.sponsor_party})` : ""}
                            {trackedBill.sponsor_state ? ` - ${trackedBill.sponsor_state}` : ""}
                          </p>
                        )}

                        {trackedBill.bill_url && (
                          <p className="mt-2">
                            <a
                              href={trackedBill.bill_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs accent-link hover:underline"
                            >
                              View bill source
                            </a>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {bill.linked_legislators?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                      Linked Legislator Scorecards
                    </p>

                    <div className="grid gap-3">
                      {bill.linked_legislators.slice(0, 4).map((legislator) => (
                        <Link
                          key={`${bill.id}-legislator-${legislator.id}`}
                          href={`/scorecards/${legislator.id}`}
                          className="panel-link block rounded-xl p-3"
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <p className="font-medium text-sm">{legislator.full_name}</p>
                              <p className="text-xs text-[var(--ink-soft)] mt-1">
                                {[legislator.role, legislator.chamber, legislator.party, legislator.state]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </p>
                            </div>
                            <span className="text-xs text-[var(--ink-soft)]">
                              Net Impact {formatImpactMetric(legislator.net_weighted_impact)}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <Link
                    href={`/future-bills?focus=${bill.id}`}
                    className="text-sm font-medium accent-link hover:underline"
                  >
                    View in Future Bills
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--ink-soft)]">No related future bills linked yet.</p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Evidence Base</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-1">
              Primary and secondary sources used to support this explainer.
            </p>
          </div>
          <span className="text-sm text-[var(--ink-soft)]">{sourceCount} linked sources</span>
        </div>

        {explainer.sources?.length ? (
          <div className="space-y-3">
            {explainer.sources.map((source) => (
              <div
                key={source.id}
                className="card-surface rounded-[1.35rem] p-4"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-semibold">{source.source_title}</h3>
                  <span className="text-xs border rounded-full px-3 py-1 bg-[rgba(255,252,247,0.8)] text-[var(--ink-soft)]">
                    {source.source_type}
                  </span>
                </div>

                <p className="text-sm text-[var(--ink-soft)] mt-2">
                  {source.publisher || "Unknown publisher"}
                  {source.published_date ? ` • ${formatSourceDate(source.published_date)}` : ""}
                </p>

                {source.notes && (
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">{source.notes}</p>
                )}

                <p className="mt-3">
                  <a
                    href={source.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm accent-link hover:underline"
                  >
                    Open source
                  </a>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--ink-soft)]">No sources linked yet.</p>
        )}
      </section>
      {relatedExplainers.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Read Next</h2>

          <div className="grid gap-4 md:grid-cols-3">
            {relatedExplainers.map((item) => (
              <Link
                key={item.slug}
                href={`/explainers/${item.slug}`}
                className="panel-link block rounded-[1.2rem] p-4"
              >
                <p className="text-sm font-medium">{item.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
