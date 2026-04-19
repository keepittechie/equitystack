import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
} from "@/app/components/public/core";
import {
  RelatedThematicPages,
  ThematicHubCard,
  ThematicQuestionList,
} from "@/app/components/public/thematic";
import TrustBar from "@/app/components/public/TrustBar";
import { getRelatedThematicPages } from "@/lib/thematic-pages";
import { buildThematicLandingJsonLd } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Black Progress Under U.S. Presidents",
  description:
    "An outcomes-focused guide to studying Black progress under U.S. presidents through policy records, legislation, promises, reports, and historical context on EquityStack.",
  path: "/analysis/black-progress-under-presidents",
  imagePath: "/images/hero/civil-rights-march.jpg",
  keywords: [
    "Black progress under presidents",
    "Black progress under U.S. presidents",
    "policy progress under presidents",
    "measurable change for Black Americans",
    "policy outcomes under U.S. presidents",
  ],
});

const WHAT_PROGRESS_MEANS = [
  {
    title: "Laws and executive actions",
    body:
      "Progress can involve changes to federal law, executive action, court-recognized protections, or administrative rules that affect rights, resources, and access for Black Americans.",
  },
  {
    title: "Enforcement and implementation",
    body:
      "A policy can exist on paper while enforcement remains weak, delayed, or uneven. EquityStack keeps implementation and evidence close to the record so users can distinguish formal change from practical effect.",
  },
  {
    title: "Access and long-term outcomes",
    body:
      "Progress can also involve access to programs, institutions, protections, and opportunity over time. That is why the site connects presidents, policies, legislation, and later outcomes rather than treating one announcement as the whole story.",
  },
];

const WHY_ADMINISTRATIONS_MATTER = [
  {
    title: "Presidents influence federal priorities",
    body:
      "Administrations can shape appointments, enforcement posture, legislative agendas, implementation priorities, and how the federal government responds to rights claims or policy gaps.",
  },
  {
    title: "Outcomes differ across administrations",
    body:
      "The same issue area can look different depending on the presidency, the available legislation, the enforcement environment, and the policy choices that followed. Comparing administrations helps users see those differences more clearly.",
  },
  {
    title: "Progress is not one-dimensional",
    body:
      "A presidency may contain advances in one area and setbacks, blockages, or mixed results in another. This page is designed as a framework for exploration rather than a single verdict about any administration.",
  },
];

const HOW_TO_USE = [
  {
    title: "Use presidents for administration-level records",
    body:
      "Start with presidential profiles when the main question is how an administration affected Black Americans through policy, promises, and broader governing context.",
  },
  {
    title: "Use policies and bills for the record itself",
    body:
      "Move into policy and bill pages when you need to study legislation, implementation, impact direction, and source-backed evidence instead of broad administration summaries.",
  },
  {
    title: "Use promises, reports, and narratives for comparison",
    body:
      "Promise Tracker separates intent from outcome, reports synthesize broader patterns, and narratives help place policy movement inside longer historical threads.",
  },
];

const START_HERE_PATHS = [
  {
    href: "/presidents",
    eyebrow: "Start with administrations",
    title: "Explore presidential impact on Black Americans",
    description:
      "Use presidential profiles to compare administrations, review Black Impact Score context, and identify which policy records most shaped the public record.",
    note: "Best first stop for administration-level comparison.",
  },
  {
    href: "/policies",
    eyebrow: "Start with measurable records",
    title: "Compare policy outcomes across administrations",
    description:
      "Use the policy explorer when the key question is which laws, executive actions, or court decisions led to measurable change, mixed outcomes, or rollback.",
    note: "Best first stop for evidence-first research.",
  },
  {
    href: "/promises",
    eyebrow: "Start with accountability",
    title: "Review campaign promises against outcomes",
    description:
      "Promise Tracker helps when the question is how presidential commitments compared with the documented records and policy actions that followed.",
    note: "Best first stop for intent-versus-outcome questions.",
  },
];

const CORE_RESEARCH_PATHS = [
  {
    href: "/presidents",
    eyebrow: "Presidents",
    title: "Explore presidential records",
    description:
      "Compare administrations, read profile pages, and trace how policy records and promises shaped the public record on Black Americans.",
  },
  {
    href: "/policies",
    eyebrow: "Policies",
    title: "Compare policy impact across administrations",
    description:
      "Use policy records to study impact direction, evidence strength, and how specific government actions contributed to progress, mixed results, or reversal.",
  },
  {
    href: "/promises",
    eyebrow: "Promises",
    title: "Review campaign promises versus outcomes",
    description:
      "Promise Tracker helps separate stated intent from documented follow-through, making it easier to compare commitment and implementation.",
  },
  {
    href: "/bills",
    eyebrow: "Bills",
    title: "Analyze legislation affecting Black communities",
    description:
      "Use the legislative layer when the question turns on federal bills, reform proposals, and the legal mechanisms connected to policy change.",
  },
  {
    href: "/reports",
    eyebrow: "Reports",
    title: "Read reports and score-focused analysis",
    description:
      "Reports help synthesize broader patterns across administrations and policy areas before you return to the underlying records.",
  },
  {
    href: "/narratives",
    eyebrow: "Narratives",
    title: "Use narratives for historical context",
    description:
      "Narratives help place policy movement inside broader arcs of rights expansion, stalled reform, rollback, and long-term institutional change.",
  },
];

const CONTEXT_PATHS = [
  {
    href: "/compare/presidents",
    eyebrow: "Comparison",
    title: "Compare presidential records side by side",
    description:
      "Use the comparison tool when you want a tighter read across administrations, score confidence, policy direction, and promise throughput.",
  },
  {
    href: "/reports/black-impact-score",
    eyebrow: "Flagship report",
    title: "Read the Black Impact Score report",
    description:
      "Use the flagship report for a broader comparative frame across presidents before returning to profile, policy, and promise detail pages.",
  },
  {
    href: "/methodology",
    eyebrow: "Methodology",
    title: "Review how measurable records are interpreted",
    description:
      "Methodology explains how scores, promise statuses, source rules, and confidence labels work so users can interpret progress claims more carefully.",
  },
  {
    href: "/sources",
    eyebrow: "Sources",
    title: "Inspect the evidence behind the records",
    description:
      "Use the source library when you want to verify the record behind a policy, promise, president profile, or report before going further.",
  },
];

const QUESTIONS = [
  "How did different presidents affect Black Americans through policy and administration priorities?",
  "What policies led to measurable change in rights, access, enforcement, or opportunity?",
  "Where did progress stall, reverse, or remain mixed across administrations?",
  "How do campaign promises compare with documented outcomes and policy records?",
  "Which research path is best when the question is about Black progress, but the answer may depend on multiple types of records?",
];

const RELATED_DESTINATIONS = [
  {
    href: "/research",
    title: "Use the research hub for adjacent themes",
    description:
      "Open the research hub when this outcomes lens leads into a broader question about presidents, reports, explainers, or methodology.",
  },
  {
    href: "/presidents",
    title: "Explore presidential records",
    description:
      "Use presidential profiles as the main administration-level entry point for this theme, especially when comparing impact across eras.",
  },
  {
    href: "/policies",
    title: "Compare policy outcomes",
    description:
      "Move into policy records when you want the evidence-bearing layer behind claims about progress, stagnation, or reversal.",
  },
  {
    href: "/bills",
    title: "Review legislative history",
    description:
      "Use the bills section when the question depends on federal legislation, reform proposals, and the legal tools connected to change.",
  },
  {
    href: "/promises",
    title: "Review campaign promises versus records",
    description:
      "Promise Tracker is useful when the question turns on what presidents promised Black communities and what the documented record shows afterward.",
  },
  {
    href: "/reports",
    title: "Read reports and public analysis",
    description:
      "Reports provide broader synthesis across administrations and issue areas before you return to the underlying public record.",
  },
];

const RELATED_THEMATIC_PAGES = getRelatedThematicPages(
  "blackProgressUnderPresidents"
);

export default function BlackProgressUnderPresidentsPage() {
  return (
    <main className="space-y-4">
      <StructuredData
        data={buildThematicLandingJsonLd({
          title: "Black Progress Under U.S. Presidents",
          description:
            "A public-interest guide to studying Black progress under U.S. presidents through policy records, legislation, promises, bills, reports, and historical context.",
          path: "/analysis/black-progress-under-presidents",
          imagePath: "/images/hero/civil-rights-march.jpg",
          about: [
            "U.S. presidents",
            "Black Americans",
            "historical policy impact",
            "civil rights policy",
            "federal legislation",
          ],
          keywords: [
            "Black progress under presidents",
            "which presidents helped Black Americans",
            "presidential impact on Black communities",
            "policy impact on Black Americans",
          ],
        })}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Black Progress Under U.S. Presidents" },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Editorial guide"
          title="Black Progress Under U.S. Presidents"
          description="This is the outcomes-and-change guide for readers asking how Black progress shifted under different presidents. It focuses on measurable change, mixed results, stalled reform, and reversal rather than broad synthesis or legislation alone."
          actions={
            <>
              <Link href="/presidents" className="dashboard-button-primary">
                Explore presidential impact
              </Link>
              <Link href="/policies" className="dashboard-button-secondary">
                Compare policy outcomes
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="public-two-col-rail grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          title="What this page is for"
          description="Use this page when the search intent is about measurable progress, policy outcomes, mixed results, or whether change advanced, stalled, or reversed under different administrations."
          detail="This page owns the outcomes lens. It should summarize broader impact questions, but route users outward when they need law, promises, or documentary record interpretation."
        />
        <MethodologyCallout
          title="How to use this guide"
          description="Start here when the question is about measurable change, move into policies or bills when you need the underlying record, and move up to the impact hub when the question becomes broader than outcomes."
          linkLabel="Review methodology"
        />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="What progress means"
          title="What “progress” means in policy terms"
          description="Progress on this page is framed through measurable public records: laws, executive actions, enforcement choices, access to programs, and longer-term outcomes visible in the dataset."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHAT_PROGRESS_MEANS.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4"
            >
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Why administrations matter"
          title="Why presidential administrations matter in this question"
          description="Presidents can influence law, implementation, enforcement, appointments, and public priorities. That means progress may look different across administrations even within the same policy area."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHY_ADMINISTRATIONS_MATTER.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4"
            >
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="How EquityStack helps"
          title="How to evaluate progress using the public record"
          description="EquityStack works best when users move deliberately between presidents, policies, promises, bills, reports, and historical context rather than relying on one metric or one page alone."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_TO_USE.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4"
            >
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Start here"
          title="Three strong ways to begin this research"
          description="Most visitors arrive with an administration question, an evidence question, or an accountability question. These paths are designed to make the first click more useful."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {START_HERE_PATHS.map((item) => (
            <ThematicHubCard
              key={item.href}
              eyebrow={item.eyebrow}
              title={item.title}
              description={item.description}
              note={item.note}
              href={item.href}
            />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Key research paths"
          title="The main destinations for this theme"
          description="These are the strongest routes for studying presidential impact, policy change, legislation, accountability, and historical context together."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CORE_RESEARCH_PATHS.map((item) => (
            <ThematicHubCard
              key={item.href}
              eyebrow={item.eyebrow}
              title={item.title}
              description={item.description}
              href={item.href}
            />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Context and verification"
          title="Use comparison, reports, and methodology to add depth"
          description="These supporting routes help readers compare administrations, verify the record, and add historical context without turning the page into a final judgment."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CONTEXT_PATHS.map((item) => (
            <ThematicHubCard
              key={item.href}
              eyebrow={item.eyebrow}
              title={item.title}
              description={item.description}
              href={item.href}
            />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Suggested questions"
          title="Questions this site helps you explore"
          description="These are research prompts for using the site, not conclusions or rankings."
        />
        <ThematicQuestionList items={QUESTIONS} />
      </section>

      <RelatedThematicPages
        items={RELATED_THEMATIC_PAGES}
        description="These related guides move from the outcomes lens into impact synthesis, broad overview context, and the opportunity-mechanism lens."
      />

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Related destinations across the public site"
          description="These routes are useful next steps when you want to move deeper into presidents, policies, bills, promises, reports, or historical narratives."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {RELATED_DESTINATIONS.map((item) => (
            <ThematicHubCard
              key={item.href}
              eyebrow="Related destination"
              title={item.title}
              description={item.description}
              href={item.href}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
