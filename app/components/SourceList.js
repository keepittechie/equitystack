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
          className="rounded-xl border border-[rgba(120,53,15,0.12)] bg-[rgba(255,252,247,0.78)] p-3"
        >
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--ink)] underline decoration-[rgba(120,53,15,0.28)] underline-offset-4 hover:text-[var(--accent)]"
            >
              {source.title}
            </a>
          ) : (
            <p className="text-sm font-medium text-[var(--ink)]">{source.title}</p>
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
