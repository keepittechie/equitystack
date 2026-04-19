import Link from "next/link";

const STATUS_TONE_CLASSES = {
  success: {
    surface: "border-[rgba(132,247,198,0.28)] bg-[rgba(132,247,198,0.07)]",
    text: "text-[var(--success)]",
    dot: "bg-[var(--success)]",
  },
  verified: {
    surface: "border-[rgba(132,247,198,0.28)] bg-[rgba(132,247,198,0.07)]",
    text: "text-[var(--success)]",
    dot: "bg-[var(--success)]",
  },
  warning: {
    surface: "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.07)]",
    text: "text-[var(--warning)]",
    dot: "bg-[var(--warning)]",
  },
  contested: {
    surface: "border-[rgba(251,191,36,0.24)] bg-[rgba(251,191,36,0.06)]",
    text: "text-[var(--warning)]",
    dot: "bg-[var(--warning)]",
  },
  danger: {
    surface: "border-[rgba(255,138,138,0.3)] bg-[rgba(255,138,138,0.07)]",
    text: "text-[var(--danger)]",
    dot: "bg-[var(--danger)]",
  },
  info: {
    surface: "border-[rgba(125,211,252,0.28)] bg-[rgba(125,211,252,0.07)]",
    text: "text-[var(--info)]",
    dot: "bg-[var(--info)]",
  },
  default: {
    surface: "border-[var(--line)] bg-[rgba(18,31,49,0.52)]",
    text: "text-[var(--ink-soft)]",
    dot: "bg-[var(--ink-muted)]",
  },
};

function resolveTone(tone = "default") {
  return STATUS_TONE_CLASSES[tone] ? tone : "default";
}

export function getStatusSurfaceClass(tone = "default") {
  return STATUS_TONE_CLASSES[resolveTone(tone)].surface;
}

export function getStatusTextClass(tone = "default") {
  return STATUS_TONE_CLASSES[resolveTone(tone)].text;
}

export function getStatusDotClass(tone = "default") {
  return STATUS_TONE_CLASSES[resolveTone(tone)].dot;
}

export function Panel({
  children,
  className = "",
  padding = "none",
  prominence = "default",
  interactive = false,
  as: Component = "section",
  ...props
}) {
  const paddingClass = {
    none: "",
    sm: "p-3 md:p-4",
    md: "p-4",
    lg: "p-5 md:p-6",
  }[padding];
  const prominenceClass =
    prominence === "primary"
      ? "border-[var(--line-strong)] bg-[rgba(11,20,33,0.96)]"
      : "border-[var(--line)] bg-[rgba(11,20,33,0.92)]";
  const interactiveClass = interactive
    ? "transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.64)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(11,20,33)]"
    : "";

  return (
    <Component
      {...props}
      className={`min-w-0 rounded-lg border ${prominenceClass} ${paddingClass} ${interactiveClass} ${className}`}
    >
      {children}
    </Component>
  );
}

export function SectionHeader({
  title,
  description,
  action = null,
  eyebrow = null,
  bordered = true,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between ${
        bordered ? "border-b border-[var(--line)] px-4 py-3" : ""
      } ${className}`}
    >
      <div className="min-w-0 max-w-full md:max-w-3xl">
        {eyebrow ? (
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-base font-semibold text-white md:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-[calc(100vw-4rem)] break-words text-[12px] leading-5 text-[var(--ink-soft)] md:max-w-3xl md:text-sm md:leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "default",
  selected = false,
  className = "",
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${getStatusSurfaceClass(
        tone
      )} ${getStatusTextClass(tone)} ${
        selected
          ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
          : ""
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(tone)}`} />
      {children}
    </span>
  );
}

export function FilterChip({ href, label, value, tone = "default" }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-7 items-center gap-2 rounded-full border px-2.5 text-[11px] font-medium transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(11,20,33)] ${getStatusSurfaceClass(
        tone
      )}`}
    >
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span className={getStatusTextClass(tone)}>{value}</span>
      <span aria-hidden="true" className="text-[var(--ink-muted)]">
        x
      </span>
    </Link>
  );
}

export function MetricCard({
  label,
  value,
  description = null,
  children = null,
  tone = "default",
  density = "default",
  prominence = "default",
  showDot = false,
  className = "",
}) {
  const isCompact = density === "compact";
  const isPrimary = prominence === "primary";

  return (
    <div
      className={`rounded-lg border shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${getStatusSurfaceClass(
        tone
      )} ${isCompact ? "px-3 py-2.5" : "p-4"} ${
        isPrimary ? "border-[var(--line-strong)] bg-[rgba(18,31,49,0.7)]" : ""
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        {showDot ? (
          <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(tone)}`} />
        ) : null}
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          {label}
        </p>
      </div>
      <p
        className={
          isCompact
            ? "mt-1 text-sm font-semibold text-white"
            : "mt-2 text-[2rem] font-semibold leading-none tracking-[-0.04em] text-white"
        }
      >
        {value}
      </p>
      {description ? (
        <p
          className={
            isCompact
              ? "mt-1 text-[11px] leading-4 text-[var(--ink-muted)]"
              : "mt-2 text-[12px] leading-5 text-[var(--ink-soft)]"
          }
        >
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
