import Link from "next/link";
import { Panel, StatusPill } from "@/app/components/dashboard/primitives";

export default function PageRoleCallout({
  title = "What this page is for",
  description,
  links = [],
  eyebrow = "Page role",
}) {
  if (!description && !(links || []).length) {
    return null;
  }

  return (
    <Panel padding="md" className="space-y-3">
      <StatusPill tone="info">{eyebrow}</StatusPill>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {description ? (
        <p className="text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      ) : null}
      {links.length ? (
        <div className="flex flex-wrap gap-2">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-8 items-center rounded-md border border-[var(--line)] bg-[rgba(18,31,49,0.58)] px-3 text-xs font-semibold text-white transition-[background-color,border-color] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
