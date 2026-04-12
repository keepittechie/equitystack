import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { KpiCard, SectionIntro } from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";

export const metadata = buildPageMetadata({
  title: "About",
  description:
    "Learn what EquityStack is, why it exists, how the data is analyzed, and what the platform does not claim to do.",
  path: "/about",
});

const ABOUT_SECTIONS = [
  {
    title: "What EquityStack is",
    body:
      "EquityStack is a public, data-driven platform for tracking how government actions affected Black Americans across policy records, promises, reports, and historical context. It is designed as a civic intelligence system, not a commentary site.",
  },
  {
    title: "Why it exists",
    body:
      "The platform exists to make policy impact easier to inspect in a structured way. It brings together policy records, evidence, promise tracking, and methodology so users can move from summary to underlying record without losing context.",
  },
  {
    title: "How data is collected and analyzed",
    body:
      "EquityStack organizes documented public records, links sources to policy and promise records, and applies structured scoring and interpretation rules that remain visible on the site. Analysis is tied to the current dataset and the quality of the available evidence.",
  },
  {
    title: "What it does not claim to do",
    body:
      "EquityStack does not claim to provide a complete account of every historical action, a final judgment of a presidency, or a substitute for reading original sources. Scores and statuses summarize the current structured record and its limitations.",
  },
];

export default function AboutPage() {
  return (
    <main className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "About" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="About EquityStack"
          title="A public research platform about presidents, policy, and Black Americans."
          description="EquityStack is built to make policy impact readable, evidence-linked, and methodologically transparent. It helps users understand what the data shows, what it does not show, and how to interpret it responsibly."
          actions={
            <>
              <Link href="/methodology" className="public-button-primary">
                Read methodology
              </Link>
              <Link href="/sources" className="public-button-secondary">
                Browse sources
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Public mission"
          value="Clarity"
          description="The site is designed to make policy impact understandable without hiding evidence or uncertainty."
          tone="accent"
        />
        <KpiCard
          label="Analytical basis"
          value="Structured"
          description="Scores, statuses, sources, and interpretations are derived from the current EquityStack dataset."
        />
        <KpiCard
          label="Tone"
          value="Neutral"
          description="The platform is intended to be factual, non-partisan, and transparent about its limits."
        />
        <KpiCard
          label="Audit path"
          value="Visible"
          description="Methodology and source access remain close to the main public pages."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
          <h2 className="text-lg font-semibold text-white">What you can do on EquityStack</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Browse presidents, campaign promises, legislation, executive actions, explainers, reports, and sources through one connected public record.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
          <h2 className="text-lg font-semibold text-white">Who it is useful for</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            The platform is designed for researchers, students, journalists, voters, and historically curious readers who want a clearer view of policy impact on Black Americans.
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {ABOUT_SECTIONS.map((item) => (
          <article
            key={item.title}
            className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6"
          >
            <h2 className="text-2xl font-semibold text-white">{item.title}</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <h2 className="text-2xl font-semibold text-white">What to read next</h2>
          <div className="mt-4 grid gap-3">
            <Link href="/dashboard" className="panel-link rounded-[1.2rem] p-4">
              <h3 className="text-lg font-semibold text-white">Open the public dashboard</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Start with the high-level view of scores, policies, promises, and current dataset coverage.
              </p>
            </Link>
            <Link href="/presidents" className="panel-link rounded-[1.2rem] p-4">
              <h3 className="text-lg font-semibold text-white">Browse presidents and Black history</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Use the presidential ranking and profile pages to inspect score drivers, trend lines, and historical policy impact on Black Americans.
              </p>
            </Link>
          </div>
        </div>
        <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <h2 className="text-2xl font-semibold text-white">How to use the platform responsibly</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            <li className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Treat scores and promise statuses as structured summaries of the current dataset.
            </li>
            <li className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Open sources and methodology when a claim needs verification.
            </li>
            <li className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Expect historical gaps, attribution limits, and uneven coverage across eras.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
