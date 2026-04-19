"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = {
  accent: "#84f7c6",
  accentAlt: "#60a5fa",
  danger: "#ff8a8a",
  warning: "#fbbf24",
  muted: "#8da1b9",
  grid: "rgba(255,255,255,0.08)",
  label: "#8da1b9",
};

function TooltipShell({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-[1rem] border border-white/10 bg-[rgba(6,10,16,0.96)] px-4 py-3 text-sm shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
      {label != null ? <p className="mb-2 font-medium text-white">{label}</p> : null}
      <div className="grid gap-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3">
            <span className="text-[var(--ink-soft)]">{entry.name}</span>
            <span style={{ color: entry.color }} className="font-medium">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportChartBlock({ title, description, children }) {
  return (
    <section className="flex h-full flex-col rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4 md:p-6">
      <div className="mb-5 flex-none">
        <h3 className="text-base font-semibold text-white md:text-lg">{title}</h3>
        {description ? (
          <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
        ) : null}
      </div>
      <div className="mt-auto h-[280px] w-full md:h-[320px] xl:h-[340px]">{children}</div>
    </section>
  );
}

export function ImpactTrendChart({ data = [], title = "Impact Over Time", description = null }) {
  return (
    <ReportChartBlock title={title} description={description}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="year" stroke={CHART_COLORS.label} tickLine={false} axisLine={false} />
          <YAxis stroke={CHART_COLORS.label} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipShell />} />
          <Legend />
          <Line type="monotone" dataKey="score" name="Score" stroke={CHART_COLORS.accent} strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="cumulative_score" name="Cumulative" stroke={CHART_COLORS.accentAlt} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ReportChartBlock>
  );
}

export function DirectionBreakdownChart({
  data = [],
  title = "Direction Breakdown",
  description = null,
}) {
  const normalized = data.length
    ? data
    : [
        { name: "Positive", value: 0, color: CHART_COLORS.accent },
        { name: "Mixed", value: 0, color: CHART_COLORS.warning },
        { name: "Negative", value: 0, color: CHART_COLORS.danger },
        { name: "Blocked", value: 0, color: CHART_COLORS.muted },
      ];

  return (
    <ReportChartBlock title={title} description={description}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={normalized} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={3}>
            {normalized.map((entry) => (
              <Cell key={entry.name} fill={entry.color || CHART_COLORS.accent} />
            ))}
          </Pie>
          <Tooltip content={<TooltipShell />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ReportChartBlock>
  );
}

export function CategoryImpactChart({
  data = [],
  title = "Category Impact",
  description = null,
  dataKey = "score",
}) {
  return (
    <ReportChartBlock title={title} description={description}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis type="number" stroke={CHART_COLORS.label} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            stroke={CHART_COLORS.label}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<TooltipShell />} />
          <Bar dataKey={dataKey} name="Impact" radius={[0, 10, 10, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={Number(entry[dataKey] || 0) >= 0 ? CHART_COLORS.accent : CHART_COLORS.danger}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportChartBlock>
  );
}
