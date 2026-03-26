import Link from "next/link";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Explainers",
  description:
    "Read EquityStack explainers on major historical debates, legal arguments, and policy narratives affecting Black Americans.",
  path: "/explainers",
});

async function getExplainers() {
  return fetchInternalJson("/api/explainers", {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch explainers",
  });
}

export default async function ExplainersPage() {
  const explainers = await getExplainers();

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-10">
      <section className="hero-panel p-8 md:p-10">
        <div className="section-intro">
          <p className="eyebrow mb-4">Editorial Library</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Explainers</h1>
          <p className="text-[var(--ink-soft)] text-lg max-w-3xl leading-8">
            Long-form, evidence-backed breakdowns of major historical and policy debates.
            These articles connect common public arguments to real laws, court decisions,
            and documented outcomes.
          </p>
        </div>
      </section>

      <section className="card-muted rounded-[1.5rem] p-5">
        <p className="text-sm text-[var(--ink-soft)] max-w-3xl leading-7">
          Use these essays as your front door into the database. Each one is designed to do
          three things clearly: frame the claim, connect it to actual policy history, and point
          you toward the records, bills, and scorecards that matter next.
        </p>
      </section>

      {explainers.length === 0 ? (
        <section className="card-surface rounded-[1.6rem] p-6">
          <p className="text-[var(--ink-soft)]">No explainers published yet.</p>
        </section>
      ) : (
        <section className="grid gap-6 md:grid-cols-2">
          {explainers.map((item) => (
            <Link
              key={item.id}
              href={`/explainers/${item.slug}`}
              className="panel-link block rounded-[1.5rem] p-6"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)] mb-2">
                {item.category || "Explainer"}
              </p>

              <h2 className="text-xl font-semibold">{item.title}</h2>

              <p className="text-[var(--ink-soft)] mt-3 text-sm leading-6">
                {item.summary}
              </p>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
