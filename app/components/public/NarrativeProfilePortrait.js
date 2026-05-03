import Image from "next/image";

function buildInitials(name = "") {
  const tokens = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens.length) {
    return "NA";
  }

  return tokens
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || "")
    .join("");
}

export default function NarrativeProfilePortrait({
  portraitUrl = null,
  portraitAlt = "",
  displayName = "",
  context = "card",
  className = "",
}) {
  const sizeClass =
    context === "hero"
      ? "w-32 md:w-40"
      : "w-24";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[rgba(18,31,49,0.72)] aspect-[4/5] ${sizeClass} ${className}`}
    >
      {portraitUrl ? (
        <Image
          src={portraitUrl}
          alt={portraitAlt || `${displayName} portrait`}
          fill
          sizes={context === "hero" ? "(min-width: 768px) 160px, 128px" : "96px"}
          className="object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,rgba(18,31,49,0.92),rgba(8,16,27,0.96))]">
          <span
            aria-hidden="true"
            className="text-xl font-semibold tracking-[0.08em] text-[var(--ink-muted)] md:text-2xl"
          >
            {buildInitials(displayName)}
          </span>
        </div>
      )}
    </div>
  );
}
