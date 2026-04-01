"use client";

export default function SourceList({ sources = [] }) {
  if (!sources.length) {
    return null;
  }

  return (
    <ul className="space-y-3">
      {sources.map((source) => (
        <li
          key={source.id}
          className="rounded-xl border border-[var(--line)] bg-white p-3"
        >
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--foreground)] underline decoration-[rgba(37,99,235,0.28)] underline-offset-4 hover:text-[var(--accent)]"
            >
              {source.title}
            </a>
          ) : (
            <p className="text-sm font-medium text-[var(--foreground)]">{source.title}</p>
          )}

          {(source.publisher || source.source_type) ? (
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              {[source.publisher, source.source_type].filter(Boolean).join(" • ")}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
