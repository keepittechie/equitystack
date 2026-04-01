export const PUBLIC_CHART_COLORS = {
  primary: "#2563EB",
  secondary: "#06B6D4",
  neutral: "#94A3B8",
  positive: "#16A34A",
  negative: "#DC2626",
  warning: "#D97706",
  blocked: "#64748B",
  grid: "#E5E7EB",
  axis: "#64748B",
  text: "#334155",
  tooltipBorder: "#E2E8F0",
  tooltipBackground: "#FFFFFF",
};

export const PUBLIC_CHART_GRID_PROPS = {
  stroke: PUBLIC_CHART_COLORS.grid,
  strokeDasharray: "3 3",
  vertical: false,
};

export const PUBLIC_CHART_AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tick: {
    fill: PUBLIC_CHART_COLORS.axis,
    fontSize: 12,
  },
};

export const PUBLIC_CHART_LEGEND_PROPS = {
  verticalAlign: "top",
  align: "left",
  iconType: "circle",
  iconSize: 8,
  wrapperStyle: {
    paddingBottom: "10px",
    fontSize: "12px",
    color: PUBLIC_CHART_COLORS.text,
  },
};

export function getPublicBarProps(fill) {
  return {
    fill,
    radius: [6, 6, 0, 0],
    maxBarSize: 44,
    activeBar: {
      fillOpacity: 0.92,
      stroke: "#0F172A",
      strokeOpacity: 0.08,
      strokeWidth: 1,
    },
  };
}

export function formatPublicChartNumber(value) {
  if (value === null || value === undefined || value === "") return "0";

  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(numeric % 1) > 0 ? 2 : 0,
  }).format(numeric);
}

export function PublicChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = formatPublicChartNumber,
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const formattedLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <div
      className="min-w-[220px] rounded-xl border p-3 shadow-sm"
      style={{
        borderColor: PUBLIC_CHART_COLORS.tooltipBorder,
        background: PUBLIC_CHART_COLORS.tooltipBackground,
      }}
    >
      {formattedLabel ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]">
          {formattedLabel}
        </p>
      ) : null}
      <div className="space-y-2">
        {payload.map((entry) => (
          <div key={`${entry.dataKey}-${entry.name}`} className="flex items-start justify-between gap-4 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="mt-[3px] inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color || entry.fill || PUBLIC_CHART_COLORS.primary }}
              />
              <span className="truncate text-[#334155]">{entry.name}</span>
            </div>
            <span className="shrink-0 font-semibold text-[#0F172A]">
              {valueFormatter(entry.value, entry)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
