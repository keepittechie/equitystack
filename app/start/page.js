import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { Breadcrumbs } from "@/app/components/public/chrome";

export const metadata = buildPageMetadata({
  title: "Start Here",
  description:
    "Follow a guided reading path through EquityStack's core explainers on law, policy, history, and long-term Black outcomes.",
  path: "/start",
});

const learningPath = [
  {
    slug: "equal-protection-under-the-law",
    title: "Equal Protection Under the Law",
    description:
      "Start with the constitutional foundation. This explainer introduces the legal principle of equal protection and the gap between formal guarantees and real-world application.",
  },
  {
    slug: "party-switch-southern-strategy",
    title: "Did the Parties Switch? The Southern Strategy Explained",
    description:
      "This provides the political realignment context needed to understand how race, law, and party coalitions changed over time.",
  },
  {
    slug: "redlining-black-homeownership",
    title: "Redlining and Black Homeownership",
    description:
      "A key explainer on how federal housing policy, lending practices, and neighborhood grading shaped wealth and exclusion.",
  },
  {
    slug: "homestead-act-exclusion",
    title: "The Homestead Act and Unequal Access to Land",
    description:
      "This explains how early land policy created wealth-building opportunities that were not equally available in practice.",
  },
  {
    slug: "gi-bill-access-and-impact",
    title: "The GI Bill: Opportunity, Access, and Unequal Outcomes",
    description:
      "A focused look at how a landmark opportunity program produced different outcomes depending on race and local implementation.",
  },
  {
    slug: "bootstraps-vs-policy-reality",
    title: "“Pull Yourself Up by Your Bootstraps” vs. Policy Reality",
    description:
      "This connects public rhetoric about self-reliance to the actual role of policy in shaping economic mobility.",
  },
  {
    slug: "crime-statistics-context-and-misuse",
    title: "Crime Statistics in Context",
    description:
      "A methodological explainer on how commonly cited statistics are measured, interpreted, and often misused in debate.",
  },
  {
    slug: "sentencing-disparities-united-states",
    title: "Sentencing Disparities in the United States",
    description:
      "This examines how laws, discretion, and institutional structure can produce unequal punishment outcomes.",
  },
  {
    slug: "mass-incarceration-policy-history",
    title: "Mass Incarceration in the United States",
    description:
      "A system-level explainer connecting sentencing, enforcement, and legislative design to incarceration growth.",
  },
  {
    slug: "government-benefits-racial-gap",
    title: "Government Benefits and the Racial Gap",
    description:
      "This synthesizes multiple policy areas to show how public investment often built opportunity unevenly.",
  },
];

export default function StartPage() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Start Here" }]} />
      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">
          Start Here
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          A guided path through Black history, policy, and EquityStack
        </h1>
        <p className="text-[var(--ink-soft)] text-lg leading-8 max-w-3xl">
          This page provides a structured introduction to the major themes covered
          on EquityStack. It is designed for readers who want a clear starting point
          and a logical sequence for understanding the relationship between law,
          policy, Black history, and long-term outcomes.
        </p>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6">
        <h2 className="text-2xl font-semibold mb-3">Recommended reading order</h2>
        <p className="text-sm text-[var(--ink-soft)] leading-7">
          The sequence below moves from constitutional foundations to political
          realignment, housing and wealth, economic mobility, and criminal justice.
          Each explainer links back into the larger policy, promise, and historical research database.
        </p>
      </section>

      <section className="space-y-4">
        {learningPath.map((item, index) => (
          <Link
            key={item.slug}
            href={`/explainers/${item.slug}`}
            className="panel-link block rounded-[1.5rem] p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold text-[var(--accent)] bg-[rgba(255,252,247,0.9)] shrink-0">
                {index + 1}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{item.title}</h2>
                <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                  {item.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="card-surface rounded-[1.6rem] p-6">
        <h2 className="text-2xl font-semibold mb-3">Where to go next</h2>
        <p className="text-sm text-[var(--ink-soft)] leading-7 max-w-3xl">
          After the guided explainers, move into the tracked record layer first, then use the report system for summary, comparison, and timeline views.
        </p>
        <div className="grid gap-4 md:grid-cols-3 mt-5">
          <Link href="/promises" className="panel-link block rounded-[1.25rem] p-5">
            <h3 className="text-lg font-semibold">Promise Tracker</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Review promises, actions, outcomes, and source-backed detail at the record level.
            </p>
          </Link>
          <Link href="/reports/black-impact-score" className="panel-link block rounded-[1.25rem] p-5">
            <h3 className="text-lg font-semibold">Black Impact Score</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Move from individual records to a president-level accountability summary built from the tracker.
            </p>
          </Link>
          <Link href="/reports/civil-rights-timeline" className="panel-link block rounded-[1.25rem] p-5">
            <h3 className="text-lg font-semibold">Timeline</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Follow the broader civil-rights arc when you want historical continuity beyond a single report state.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
