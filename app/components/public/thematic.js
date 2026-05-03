import Link from "next/link";
import { Panel, StatusPill } from "@/app/components/dashboard/primitives";
import { SectionIntro } from "@/app/components/public/core";

export function ThematicHubCard({
  eyebrow,
  title,
  description,
  href,
  note = null,
}) {
  const content = (
    <>
      {eyebrow ? (
        <StatusPill tone="info">{eyebrow}</StatusPill>
      ) : null}
      <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      {note ? (
        <p className="mt-3 text-[12px] leading-5 text-[var(--ink-muted)]">{note}</p>
      ) : null}
    </>
  );

  if (!href) {
    return (
      <Panel as="article" padding="md">
        {content}
      </Panel>
    );
  }

  return (
    <Panel
      as={Link}
      href={href}
      padding="md"
      interactive
    >
      {content}
    </Panel>
  );
}

export function ThematicQuestionList({ items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <Panel
          key={item}
          padding="md"
          className="text-sm leading-7 text-[var(--ink-soft)]"
        >
          {item}
        </Panel>
      ))}
    </div>
  );
}

export function RelatedThematicPages({
  eyebrow = "Related thematic guides",
  title = "Continue through related research themes",
  description = "These pages approach the same subject from different angles so users can choose the frame that best fits their question.",
  items = [],
}) {
  if (!items.length) {
    return null;
  }

  const gridClassName =
    items.length > 2 ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4 md:grid-cols-2";

  return (
    <section className="space-y-5">
      <SectionIntro
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      <div className={gridClassName}>
        {items.map((item) => (
          <ThematicHubCard
            key={item.href}
            eyebrow={item.eyebrow || "Related theme"}
            title={item.title}
            description={item.description}
            note={item.note}
            href={item.href}
          />
        ))}
      </div>
    </section>
  );
}
