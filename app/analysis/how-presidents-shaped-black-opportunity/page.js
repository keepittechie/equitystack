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
  title: "How Presidents Shaped Black Opportunity",
  description:
    "A systems-focused guide to studying how presidents shaped Black opportunity through policy, legislation, enforcement, federal investment, campaign promises, and historical context on EquityStack.",
  path: "/analysis/how-presidents-shaped-black-opportunity",
  imagePath: "/images/hero/civil-rights-march.jpg",
  keywords: [
    "how presidents shaped Black opportunity",
    "presidents and Black opportunity",
    "economic opportunity for Black Americans by president",
    "presidential influence on Black opportunity",
    "Black opportunity under U.S. presidents",
  ],
});

const WHAT_OPPORTUNITY_MEANS = [
  {
    title: "Education, training, and access",
    body:
      "Opportunity can involve access to schools, colleges, training programs, desegregation enforcement, and the public systems that shape who can move into stable employment or civic life.",
  },
  {
    title: "Labor, housing, and economic participation",
    body:
      "It can also involve wages, work, labor protections, housing access, lending, business participation, and whether government action widened or narrowed material paths to advancement for Black Americans.",
  },
  {
    title: "Rights, voting, and federal protections",
    body:
      "Opportunity is also affected by civil-rights enforcement, voting access, equal treatment in federal programs, and the practical reach of legal protections over time.",
  },
];

const WHY_PRESIDENTS_MATTER = [
  {
    title: "Administrations shape federal priorities",
    body:
      "Presidents can influence opportunity through legislative agendas, executive action, agency leadership, federal investment priorities, and the public direction of enforcement across departments and programs.",
  },
  {
    title: "Appointments and implementation matter",
    body:
      "The effect of a policy often depends on how agencies implement it, which appointments are made, and whether enforcement is active, delayed, narrowed, or abandoned over time.",
  },
  {
    title: "Opportunity is a governance question",
    body:
      "Questions about opportunity often cut across multiple policy areas at once. EquityStack keeps laws, policies, promises, reports, and narratives close together so readers can follow those connections.",
  },
];

const HOW_TO_USE = [
  {
    title: "Start with presidents for the administration frame",
    body:
      "Use presidential profiles when the question is how one administration or era shaped access, rights, advancement, and federal priorities affecting Black opportunity.",
  },
  {
    title: "Move to policies and bills for the record itself",
    body:
      "Policy and bill pages are the best next stop when you need to inspect the laws, executive actions, court-linked records, and tracked legislation that shaped concrete opportunities or barriers.",
  },
  {
    title: "Use promises, reports, explainers, and narratives for depth",
    body:
      "Promises show stated intent, reports synthesize larger patterns, explainers add historical grounding, and narratives help place specific records inside longer arcs of change.",
  },
];

const START_HERE_PATHS = [
  {
    href: "/presidents",
    eyebrow: "Start with administrations",
    title: "Explore presidential records on opportunity",
    description:
      "Use presidential profiles when you want the administration-level entry point into how policy, promises, and federal priorities shaped Black opportunity.",
    note: "Best first stop for presidency-level comparison.",
  },
  {
    href: "/policies",
    eyebrow: "Start with policy records",
    title: "Review policies affecting access and advancement",
    description:
      "Move into policy records when the question is about measurable changes in housing, education, labor, rights enforcement, or access to protections and programs.",
    note: "Best first stop for evidence-first research.",
  },
  {
    href: "/bills",
    eyebrow: "Start with legislation",
    title: "Browse legislation shaping opportunity",
    description:
      "Use the bills layer when the question turns on federal law, reform proposals, and the legal structure behind access, exclusion, or expansion.",
    note: "Best first stop for law-and-reform questions.",
  },
];

const CORE_RESEARCH_PATHS = [
  {
    href: "/presidents",
    eyebrow: "Presidents",
    title: "Explore presidential records affecting Black opportunity",
    description:
      "Compare administrations, profile pages, and score context when you need to understand how presidencies shaped access, enforcement, and broader policy direction.",
  },
  {
    href: "/policies",
    eyebrow: "Policies",
    title: "Review policies tied to access and advancement",
    description:
      "Use policy records to study education, labor, housing, rights enforcement, and other areas where government action shaped opportunity for Black Americans.",
  },
  {
    href: "/bills",
    eyebrow: "Bills",
    title: "Browse legislation shaping opportunity and rights",
    description:
      "Legislative records help when the question depends on Congress, formal statutory change, or reform proposals linked to long-term opportunity.",
  },
  {
    href: "/promises",
    eyebrow: "Promises",
    title: "Compare campaign commitments with outcomes",
    description:
      "Promise Tracker helps separate what presidents said about opportunity, equity, rights, and access from the policy record that followed.",
  },
  {
    href: "/reports",
    eyebrow: "Reports",
    title: "Read reports analyzing long-term patterns",
    description:
      "Reports provide a broader frame for comparing administrations, issue areas, and public records before returning to individual policies or promises.",
  },
  {
    href: "/explainers",
    eyebrow: "Explainers",
    title: "Use explainers for historical context",
    description:
      "Historical explainers help place opportunity-related records inside larger legal, institutional, and civil-rights histories.",
  },
];

const CONTEXT_PATHS = [
  {
    href: "/narratives",
    eyebrow: "Narratives",
    title: "Follow longer historical pathways",
    description:
      "Narratives help connect policy records into broader patterns of expansion, stalled reform, rollback, and uneven access across eras.",
  },
  {
    href: "/compare/presidents",
    eyebrow: "Comparison",
    title: "Compare presidencies when opportunity records diverge",
    description:
      "Use the comparison tool when you want a tighter read across administrations, score context, promises, and the mix of policy directions tied to opportunity.",
  },
  {
    href: "/methodology",
    eyebrow: "Methodology",
    title: "Review how public records and scores are interpreted",
    description:
      "Methodology explains how impact, promise status, evidence strength, and confidence labels are handled before you draw larger conclusions.",
  },
  {
    href: "/sources",
    eyebrow: "Sources",
    title: "Inspect the evidence behind opportunity-related records",
    description:
      "Use the source library when you want to verify the record behind a policy, promise, president profile, or report linked from this guide.",
  },
];

const QUESTIONS = [
  "How did different administrations shape access and opportunity for Black Americans?",
  "Which policies expanded or limited Black opportunity across housing, labor, education, voting, or federal protections?",
  "How do campaign promises compare with measurable action and implementation?",
  "What role did legislation play in longer-term opportunity outcomes?",
  "When is the best place to start if the question spans presidents, policies, and historical context at the same time?",
];

const RELATED_DESTINATIONS = [
  {
    href: "/research",
    title: "Use the research hub for adjacent pathways",
    description:
      "Open the research hub when this opportunity guide leads into a broader question about presidents, reports, explainers, or the site’s core research routes.",
  },
  {
    href: "/presidents",
    title: "Explore presidential records on opportunity",
    description:
      "Use presidential profiles as the main administration-level entry point for this theme, especially when comparing eras or governing priorities.",
  },
  {
    href: "/policies",
    title: "Review policies affecting access and advancement",
    description:
      "Move into policy records when you want the evidence-bearing layer behind claims about opportunity, exclusion, or mixed outcomes.",
  },
  {
    href: "/bills",
    title: "Browse legislation shaping opportunity",
    description:
      "Use the bills section when the question depends on federal law, reform proposals, or the legal architecture behind access and rights.",
  },
  {
    href: "/promises",
    title: "Compare promises with outcomes",
    description:
      "Promise Tracker is useful when the question turns on what presidents committed to do and what the documented record shows afterward.",
  },
  {
    href: "/reports",
    title: "Read reports and public analysis",
    description:
      "Reports help synthesize longer-term patterns across administrations and issue areas before you return to the underlying records.",
  },
];

const RELATED_THEMATIC_PAGES = getRelatedThematicPages(
  "howPresidentsShapedBlackOpportunity"
);

export default function HowPresidentsShapedBlackOpportunityPage() {
  return (
    <main className="space-y-10">
      <StructuredData
        data={buildThematicLandingJsonLd({
          title: "How Presidents Shaped Black Opportunity",
          description:
            "A public-interest guide to studying how presidents shaped Black opportunity through policies, legislation, promises, reports, and historical context.",
          path: "/analysis/how-presidents-shaped-black-opportunity",
          imagePath: "/images/hero/civil-rights-march.jpg",
          about: [
            "Black opportunity",
            "U.S. presidents",
            "public policy",
            "federal legislation",
            "historical policy impact",
          ],
          keywords: [
            "how presidents shaped Black opportunity",
            "economic opportunity for Black Americans by president",
            "presidents and Black opportunity",
            "presidential influence on Black opportunity",
            "Black opportunity under U.S. presidents",
          ],
        })}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "How Presidents Shaped Black Opportunity" },
        ]}
      />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Editorial guide"
          title="How Presidents Shaped Black Opportunity"
          description="This is the systems-and-governance guide for readers asking how presidents shaped Black opportunity. It focuses on the mechanisms of access, advancement, federal priorities, and policy design rather than broad synthesis or evidence review alone."
          actions={
            <>
              <Link href="/presidents" className="public-button-primary">
                Explore presidential records on opportunity
              </Link>
              <Link href="/policies" className="public-button-secondary">
                Review policies affecting access and advancement
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          title="What this page is for"
          description="Use this page when the search intent is about Black opportunity, access, advancement, and the governance pathways that shaped those conditions under different presidents."
          detail="This page owns the mechanism lens. It should explain how opportunity is shaped, while sending users upward for broad impact synthesis and sideways for documentary record review."
        />
        <MethodologyCallout
          title="How to use this guide"
          description="Start here when the question is about systems and mechanisms, move into policies or bills when the record itself matters most, and move up to the impact hub when the question becomes broader than opportunity."
          linkLabel="Review methodology"
        />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="What opportunity means"
          title="What “opportunity” means in public policy terms"
          description="On this page, opportunity is framed through public records that shaped access, rights, advancement, and material conditions rather than through opinion alone."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHAT_OPPORTUNITY_MEANS.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6"
            >
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Why presidents matter"
          title="Why presidential administrations matter in this question"
          description="Presidents can shape opportunity through legislative agendas, executive action, appointments, agency priorities, enforcement decisions, and public commitments that influence what rights and resources are available in practice."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHY_PRESIDENTS_MATTER.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6"
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
          title="How to explore Black opportunity on EquityStack"
          description="The site works best when users move across presidents, policies, bills, promises, reports, explainers, and narratives rather than relying on one page or one metric alone."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_TO_USE.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6"
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
          title="Three strong ways to begin opportunity-focused research"
          description="Most visitors arrive with an administration question, a policy question, or a law-and-reform question. These paths are designed to make the first click more useful."
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
          title="The main destinations for studying opportunity through policy and governance"
          description="These routes are the strongest next steps when the question is how presidencies shaped access, advancement, rights, and longer-term conditions for Black Americans."
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
          title="Use comparison, narratives, and methodology to add depth"
          description="These supporting routes help readers move from a broad opportunity question into comparison, historical context, and the underlying evidence base."
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
          description="These are research prompts for using the site, not rankings or conclusions about any administration."
        />
        <ThematicQuestionList items={QUESTIONS} />
      </section>

      <RelatedThematicPages
        items={RELATED_THEMATIC_PAGES}
        description="These related guides move from opportunity mechanisms into broad impact synthesis, overview context, and evidence-focused record review."
      />

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Related destinations across the public site"
          description="These routes are useful next steps when you want to move deeper into presidents, policies, legislation, promises, reports, explainers, or historical narratives."
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
