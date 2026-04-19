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
  title: "Presidential Impact on Black Americans",
  description:
    "A top-level synthesis guide to studying presidential impact on Black Americans through laws, policies, promises, executive action, enforcement, reports, and historical context on EquityStack.",
  path: "/analysis/presidential-impact-on-black-americans",
  imagePath: "/images/hero/civil-rights-march.jpg",
  keywords: [
    "presidential impact on Black Americans",
    "presidents and Black Americans impact",
    "how presidents affected Black Americans",
    "impact of presidents on Black communities",
    "U.S. presidents and Black Americans",
  ],
});

const WHAT_IMPACT_MEANS = [
  {
    title: "Rights, protections, and legal change",
    body:
      "Presidential impact can involve civil-rights protections, voting access, court-era consequences, federal enforcement, and how administrations shaped the practical reach of legal rights over time.",
  },
  {
    title: "Policy, legislation, and executive action",
    body:
      "Impact also includes laws signed, reform agendas pursued, executive actions taken, agency priorities set, and the policy records that show whether administrations expanded, narrowed, or redirected federal action.",
  },
  {
    title: "Opportunity and longer historical effects",
    body:
      "Impact may also involve housing, labor, education, federal investment, access to programs, and other material conditions reflected in the public record and later historical interpretation.",
  },
];

const WHY_ADMINISTRATIONS_MATTER = [
  {
    title: "Presidents shape federal priorities",
    body:
      "Administrations influence what the federal government emphasizes, funds, enforces, resists, or delays. That makes presidents a meaningful lens for studying Black history and policy change together.",
  },
  {
    title: "Executive power matters alongside legislation",
    body:
      "Presidential impact is not limited to bills signed into law. Executive action, agency leadership, appointments, enforcement choices, and public commitments can all shape the record in ways that outlast one term.",
  },
  {
    title: "Impact is multi-layered",
    body:
      "No single policy, promise, or score captures an entire presidency. EquityStack keeps presidents, policies, legislation, reports, explainers, and narratives connected so users can study that complexity more carefully.",
  },
];

const HOW_TO_USE = [
  {
    title: "Start with presidents for the broad administration frame",
    body:
      "Use presidential profiles when the main question is how an administration affected Black Americans across multiple policy areas and historical contexts.",
  },
  {
    title: "Move into policies, bills, and promises for detail",
    body:
      "Policy records, bills, and Promise Tracker are the best next steps when you need to inspect the underlying actions, legislation, commitments, and evidence trails behind a broader claim.",
  },
  {
    title: "Use reports, explainers, narratives, and methodology for synthesis",
    body:
      "Reports help compare administrations, explainers and narratives add historical grounding, and methodology clarifies how the site organizes impact, evidence, and record interpretation.",
  },
];

const START_HERE_PATHS = [
  {
    href: "/presidents",
    eyebrow: "Start with administrations",
    title: "Explore presidential impact records",
    description:
      "Use presidential profiles to compare administrations, review score context, and identify which policies, promises, and records shaped the public record on Black Americans.",
    note: "Best first stop for broad administration-level research.",
  },
  {
    href: "/policies",
    eyebrow: "Start with policy pathways",
    title: "Review policy and legislative pathways",
    description:
      "Move into policy records when the question turns on laws, executive action, court-linked outcomes, enforcement, and the record behind long-term change.",
    note: "Best first stop for evidence-first policy research.",
  },
  {
    href: "/reports",
    eyebrow: "Start with synthesis",
    title: "Read cross-administration report analysis",
    description:
      "Use reports when you want a higher-level frame across administrations before returning to president profiles, policy records, and legislative detail.",
    note: "Best first stop for comparative synthesis.",
  },
];

const KEY_RESEARCH_PATHS = [
  {
    href: "/presidents",
    eyebrow: "Presidents",
    title: "Explore presidential impact records",
    description:
      "Compare administrations and move from presidential profiles into the specific policies, promises, and evidence tied to Black Americans.",
  },
  {
    href: "/policies",
    eyebrow: "Policies",
    title: "Review policy impact",
    description:
      "Use policy records to study how laws, executive actions, and administrative choices shaped rights, access, enforcement, and opportunity over time.",
  },
  {
    href: "/bills",
    eyebrow: "Bills",
    title: "Browse legislation affecting Black Americans",
    description:
      "The bills layer helps when the question turns on federal law, congressional action, reform proposals, and the legislative pathways behind impact.",
  },
  {
    href: "/promises",
    eyebrow: "Promises",
    title: "Compare promises with outcomes",
    description:
      "Promise Tracker helps distinguish campaign or governing commitments from what the documented public record shows later.",
  },
  {
    href: "/reports",
    eyebrow: "Reports",
    title: "Read reports synthesizing cross-administration patterns",
    description:
      "Reports provide a broader analytical frame for comparing presidencies and issue areas before you return to the underlying records.",
  },
  {
    href: "/explainers",
    eyebrow: "Historical context",
    title: "Read historical context and report analysis",
    description:
      "Explainers and related historical materials help place specific records inside longer arcs of legal change, reform, conflict, and consequence.",
  },
];

const CONTEXT_PATHS = [
  {
    href: "/narratives",
    eyebrow: "Narratives",
    title: "Use narratives for longer historical context",
    description:
      "Narratives connect individual records into broader patterns of expansion, rollback, delay, mixed outcomes, and institutional change across eras.",
  },
  {
    href: "/compare/presidents",
    eyebrow: "Comparison",
    title: "Compare presidencies side by side",
    description:
      "Use the comparison tool when you want a tighter read across administrations, score context, promise throughput, and overall directional mix.",
  },
  {
    href: "/methodology",
    eyebrow: "Methodology",
    title: "Review how impact records are organized",
    description:
      "Methodology explains how scores, promise statuses, evidence strength, confidence labels, and record interpretation work across the site.",
  },
  {
    href: "/sources",
    eyebrow: "Sources",
    title: "Inspect the evidence behind the records",
    description:
      "Use the source library when you want to verify the evidence base behind a president profile, policy page, report, or promise record.",
  },
];

const QUESTIONS = [
  "How did different presidents affect Black Americans across rights, access, and enforcement?",
  "Which policies and laws had lasting effects on Black communities?",
  "How did administrations differ in rights, opportunity, and federal priorities?",
  "How should users connect promises, policy records, legislation, and broader outcomes?",
  "Which EquityStack route is best when the question starts broad but needs evidence and historical context?",
];

const RELATED_DESTINATIONS = [
  {
    href: "/research",
    title: "Use the research hub for broader navigation",
    description:
      "Open the research hub when this synthesis page leads into a larger question and you want curated paths across themes, reports, explainers, methods, and sources.",
  },
  {
    href: "/presidents",
    title: "Explore presidential impact records",
    description:
      "Use presidential profiles as the main administration-level entry point for this theme, especially when comparing presidencies across eras.",
  },
  {
    href: "/policies",
    title: "Review policy and legislative pathways",
    description:
      "Move into policy records when you want the evidence-bearing layer behind claims about rights, opportunity, enforcement, and historical change.",
  },
  {
    href: "/bills",
    title: "Browse legislation affecting Black Americans",
    description:
      "Use the bills section when the question depends on statutory change, reform proposals, and the legal mechanisms behind impact.",
  },
  {
    href: "/promises",
    title: "Compare promises with outcomes",
    description:
      "Promise Tracker is useful when the question turns on what administrations promised and what the public record shows afterward.",
  },
  {
    href: "/reports",
    title: "Read report analysis",
    description:
      "Reports help synthesize cross-administration patterns before you return to underlying policies, bills, and presidential records.",
  },
];

const FLAGSHIP_SUPPORT = [
  {
    title: "Why readers use this page",
    description:
      "This is the top synthesis guide for the broad impact question. It is the best first link when the reader needs a serious overview before choosing between law, promises, opportunity, or records-focused analysis.",
  },
  {
    title: "What this guide does not replace",
    description:
      "It organizes the major research lenses, but it does not replace the specialist pages that own civil-rights law, documentary record review, or campaign follow-through.",
  },
  {
    title: "Best way to cite or share it",
    description:
      "Use this page as the broad thematic reference, then pair it with a flagship report, a president profile, or the methodology page when the argument depends on interpretation or evidence detail.",
  },
];

const RELATED_THEMATIC_PAGES = getRelatedThematicPages(
  "presidentialImpactOnBlackAmericans"
);

export default function PresidentialImpactOnBlackAmericansPage() {
  return (
    <main className="space-y-4">
      <StructuredData
        data={buildThematicLandingJsonLd({
          title: "Presidential Impact on Black Americans",
          description:
            "A public-interest guide to studying presidential impact on Black Americans through rights, policy, legislation, promises, enforcement, reports, and historical context.",
          path: "/analysis/presidential-impact-on-black-americans",
          imagePath: "/images/hero/civil-rights-march.jpg",
          about: [
            "presidential impact",
            "Black Americans",
            "U.S. presidents",
            "public policy",
            "historical policy impact",
          ],
          keywords: [
            "presidential impact on Black Americans",
            "U.S. presidents and Black Americans",
            "presidents and Black Americans impact",
            "how presidents affected Black Americans",
            "impact of presidents on Black communities",
          ],
        })}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Presidential Impact on Black Americans" },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Editorial guide"
          title="Presidential Impact on Black Americans"
          description="This is the top-level synthesis hub for readers asking how presidents affected Black Americans. It brings together the major research lenses on the site, including rights, policy, legislation, enforcement, promises, opportunity, and historical change."
          actions={
            <>
              <Link href="/presidents" className="dashboard-button-primary">
                Explore presidential impact records
              </Link>
              <Link href="/reports" className="dashboard-button-secondary">
                Read historical context and report analysis
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="public-two-col-rail grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          title="What this page is for"
          description="Use this page when the search intent is broad: presidential impact on Black Americans, how presidents affected Black Americans, or the overall impact of administrations on Black communities."
          detail="This page owns the synthesis layer. It should connect the main research lenses together without replacing the more specific law, promises, opportunity, and records pages."
        />
        <MethodologyCallout
          title="How to use this guide"
          description="Start here when the question is broad, then move down into policies, bills, promises, opportunity, or records pages when you need a narrower lens."
          linkLabel="Review EquityStack methodology"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FLAGSHIP_SUPPORT.map((item) => (
          <article
            key={item.title}
            className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4"
          >
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="What impact means"
          title="What “presidential impact” means here"
          description="On this page, impact is framed through documented laws, policies, enforcement choices, public commitments, and longer historical consequences reflected across the site."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHAT_IMPACT_MEANS.map((item) => (
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
          title="Why presidential administrations matter"
          description="Presidents influence federal priorities, executive action, appointments, legislative agendas, enforcement posture, and public commitments that shape the practical effect of government on Black Americans."
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
          title="How to study presidential impact on EquityStack"
          description="The site works best when users move across presidents, policies, bills, promises, reports, explainers, narratives, and methodology instead of relying on one page or one signal alone."
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
          title="Three strong ways to begin a broad impact review"
          description="Most visitors arrive with an administration question, a policy-path question, or a synthesis question. These paths are designed to make the first click more useful."
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
          title="The main routes for understanding presidential impact"
          description="These routes are the strongest next steps when the question is how presidents affected Black Americans across policy, legislation, promises, enforcement, and historical change."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {KEY_RESEARCH_PATHS.map((item) => (
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
          title="Use narratives, comparison, sources, and methodology to add depth"
          description="These supporting routes help readers compare administrations, verify the record, and place specific impacts inside longer historical patterns."
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
          title="Questions this site can help answer"
          description="These are research prompts for using the site, not rankings or unsupported conclusions."
        />
        <ThematicQuestionList items={QUESTIONS} />
      </section>

      <RelatedThematicPages
        items={RELATED_THEMATIC_PAGES}
        description="These related guides move from the top-level impact hub into the three main specialist directions it should feed: broad overview, civil-rights law, and documentary record review."
      />

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Related destinations across the public site"
          description="These routes are useful next steps when you want to move deeper into presidents, policies, bills, promises, reports, explainers, narratives, or methodology."
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
