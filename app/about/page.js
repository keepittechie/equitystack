import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { CitationNote, KpiCard, SectionIntro } from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import {
  buildAboutPageJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/structured-data";

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
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "About" }],
            "/about"
          ),
          buildAboutPageJsonLd({
            title: "About EquityStack",
            description:
              "Learn what EquityStack is, how it studies presidents, promises, policies, and Black Americans, and where its analytical limits begin.",
            path: "/about",
            about: [
              "EquityStack",
              "public-interest research",
              "U.S. presidents",
              "Black Americans",
              "policy impact",
            ],
            keywords: [
              "about EquityStack",
              "Black policy research site",
              "public-interest research platform",
            ],
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "About" }]} />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="About EquityStack"
          title="A public research platform about presidents, policy, and Black Americans."
          description="EquityStack is built to make policy impact readable, evidence-linked, and methodologically transparent. It helps users understand what the data shows, what it does not show, and how to interpret it responsibly."
          actions={
            <>
              <Link href="/methodology" className="dashboard-button-primary">
                Read methodology
              </Link>
              <Link href="/sources" className="dashboard-button-secondary">
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

      <section className="grid gap-6 border-t border-[var(--line)] pt-6 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-white">What you can do on EquityStack</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Browse presidents, campaign promises, legislation, executive actions, explainers, reports, and sources through one connected public record.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Who it is useful for</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            The platform is designed for researchers, students, journalists, voters, and historically curious readers who want a clearer view of policy impact on Black Americans.
          </p>
        </div>
      </section>

      <CitationNote
        title="When to link this page"
        description="Use the About page when someone needs a concise description of what EquityStack is, what it studies, and what it does not claim to do. Pair it with the methodology page or source library when the audience needs verification detail beyond the platform description."
      />

      <section className="grid gap-x-8 gap-y-6 border-t border-[var(--line)] pt-6 md:grid-cols-2">
        {ABOUT_SECTIONS.map((item) => (
          <article key={item.title}>
            <h2 className="text-2xl font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
          <h2 className="text-2xl font-semibold text-white">What to read next</h2>
          <div className="mt-4 grid gap-3">
            <Link href="/dashboard" className="panel-link p-4">
              <h3 className="text-lg font-semibold text-white">Open the public dashboard</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Start with the high-level view of scores, policies, promises, and current dataset coverage.
              </p>
            </Link>
            <Link href="/presidents" className="panel-link p-4">
              <h3 className="text-lg font-semibold text-white">Browse presidents and Black history</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Use the presidential ranking and profile pages to inspect score drivers, trend lines, and historical policy impact on Black Americans.
              </p>
            </Link>
          </div>
        </div>
        <div className="border-l-0 border-t border-[var(--line)] pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <h2 className="text-2xl font-semibold text-white">How to use the platform responsibly</h2>
          <ul className="mt-4 grid gap-4 text-sm leading-7 text-[var(--ink-soft)]">
            <li className="border-l border-[var(--line)] pl-4">
              Treat scores and promise statuses as structured summaries of the current dataset.
            </li>
            <li className="border-l border-[var(--line)] pl-4">
              Open sources and methodology when a claim needs verification.
            </li>
            <li className="border-l border-[var(--line)] pl-4">
              Expect historical gaps, attribution limits, and uneven coverage across eras.
            </li>
          </ul>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/methodology" className="panel-link p-4">
          <h2 className="text-lg font-semibold text-white">Methodology</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Share the methodology page when a reader needs to understand the rules behind scores, statuses, and confidence labels.
          </p>
        </Link>
        <Link href="/sources" className="panel-link p-4">
          <h2 className="text-lg font-semibold text-white">Sources</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Use the source library when someone wants to inspect the public evidence base behind EquityStack&apos;s summaries.
          </p>
        </Link>
        <Link href="/start" className="panel-link p-4">
          <h2 className="text-lg font-semibold text-white">Guided research path</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Link the research guide when a first-time visitor needs a structured introduction to the strongest public explainers and themes.
          </p>
        </Link>
      </section>
    </main>
  );
}
