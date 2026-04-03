"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  PUBLIC_CHART_AXIS_PROPS,
  PUBLIC_CHART_COLORS,
  PUBLIC_CHART_GRID_PROPS,
  PUBLIC_CHART_LEGEND_PROPS,
  PublicChartTooltip,
  formatPublicChartNumber,
  getPublicBarProps,
} from "@/app/components/charts/publicChartTheme";

function formatNumber(value) {
  return formatPublicChartNumber(value);
}

function sortRows(rows, field) {
  return [...rows].sort((a, b) => Number(b?.[field] ?? 0) - Number(a?.[field] ?? 0));
}

function getTopRow(rows, field) {
  return sortRows(rows, field)[0] || null;
}

function chartRows(rows, field, options = {}) {
  if (!Array.isArray(rows)) return [];
  if (!field || options.keepOrder) return rows;
  return sortRows(rows, field);
}

function ChartShell({
  title,
  description,
  height = 360,
  minWidth = 700,
  children,
  ready,
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div>
        <h3 className="section-title">{title}</h3>
        {description ? (
          <p className="text-sm text-[var(--ink-soft)] mt-1 max-w-3xl">{description}</p>
        ) : null}
      </div>

      <div className="report-scroll-x card-surface rounded-[1.6rem] p-5">
        <div style={{ width: "100%", height: `${height}px`, minWidth: 0 }}>
          {ready ? children : <div className="w-full h-full" />}
        </div>
      </div>
    </section>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="metric-card p-5">
      <p className="text-sm text-[var(--ink-soft)]">{title}</p>
      <p className="text-3xl font-bold mt-2">{formatNumber(value)}</p>
      {subtitle ? <p className="text-sm text-[var(--ink-soft)] mt-2">{subtitle}</p> : null}
    </div>
  );
}

function JumpChip({ targetId, label }) {
  return (
    <a
      href={`#${targetId}`}
      className="public-pill px-4 py-2 text-sm hover:border-[var(--line-strong)] hover:text-[var(--accent)]"
    >
      {label}
    </a>
  );
}

function FindingCard({ eyebrow, title, body }) {
  return (
    <div className="card-surface min-w-0 rounded-[1.5rem] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{eyebrow}</p>
      <h3 className="text-xl font-semibold mt-3">{title}</h3>
      <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">{body}</p>
    </div>
  );
}

function SectionShell({ id, eyebrow, title, description, children }) {
  return (
    <section
      id={id}
      className="card-surface min-w-0 rounded-[1.8rem] p-5 md:p-7 space-y-5 scroll-mt-24"
    >
      <div className="section-intro">
        <p className="eyebrow mb-4">{eyebrow}</p>
        <h2 className="text-3xl font-semibold">{title}</h2>
        <p className="text-[var(--ink-soft)] mt-3 leading-7">{description}</p>
      </div>
      {children}
    </section>
  );
}

function RankingList({ title, description, rows, labelKey, valueKey, valueLabel }) {
  return (
    <section className="min-w-0 space-y-3">
      <div>
        <h3 className="text-2xl font-semibold">{title}</h3>
        {description ? (
          <p className="text-sm text-[var(--ink-soft)] mt-1">{description}</p>
        ) : null}
      </div>

      <div className="card-muted rounded-[1.6rem] p-4 space-y-3">
        {rows.map((row, index) => (
          <div
            key={`${row?.[labelKey] || row?.name || index}`}
            className="flex items-center justify-between gap-4 rounded-[1.15rem] border border-[var(--line)] bg-white px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
                Rank {index + 1}
              </p>
              <p className="font-semibold mt-1 truncate">{row?.[labelKey] || row?.name || "Unknown"}</p>
            </div>

            <div className="text-right shrink-0">
              <p className="text-2xl font-bold">{formatNumber(row?.[valueKey] ?? 0)}</p>
              <p className="text-xs text-[var(--ink-soft)] mt-1">{valueLabel}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PolicyCard({ policy, titleLabel = "Total Score", titleValue }) {
  return (
    <Link
      href={`/policies/${policy.id}`}
      className="panel-link block min-w-0 rounded-[1.5rem] p-5"
    >
      <h3 className="text-lg font-semibold">{policy.title}</h3>
      <p className="text-sm text-[var(--ink-soft)] mt-1">
        {policy.year_enacted} {" • "} {policy.policy_type} {" • "}{" "}
        {policy.primary_party || "Unknown party"}
      </p>
      <p className="text-sm text-[var(--ink-soft)]">
        {policy.era || "Unknown era"} {" • "} {policy.president || "Unknown president"}
      </p>
      {policy.summary ? (
        <p className="mt-3 text-sm text-[var(--ink-soft)] leading-7 line-clamp-3">
          {policy.summary}
        </p>
      ) : null}
      <p className="mt-3 text-sm">
        <strong>{titleLabel}:</strong> {titleValue}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
        {Number(policy.related_explainer_count || 0) > 0 ? (
          <span className="public-pill">
            Explainers: {policy.related_explainer_count}
          </span>
        ) : null}
        {Number(policy.related_future_bill_count || 0) > 0 ? (
          <span className="public-pill">
            Future Bills: {policy.related_future_bill_count}
          </span>
        ) : null}
        {Number(policy.linked_legislator_count || 0) > 0 ? (
          <span className="public-pill">
            Scorecards: {policy.linked_legislator_count}
          </span>
        ) : null}
      </div>
      {policy.impact_notes ? (
        <p className="mt-2 text-sm text-[var(--ink-soft)] line-clamp-3">
          <strong>Notes:</strong> {policy.impact_notes}
        </p>
      ) : null}
    </Link>
  );
}

function formatDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ReportsDashboard({
  overallSummary,
  partySummaryRows,
  eraSummaryRows,
  categorySummaryRows,
  directImpactByPartyRows,
  directImpactByEraRows,
  topPolicies,
  rollbackRows,
  futureBills,
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const safeOverall = overallSummary || {};
  const safePartyRows = partySummaryRows || [];
  const safeEraRows = eraSummaryRows || [];
  const safeCategoryRows = categorySummaryRows || [];
  const safeDirectPartyRows = directImpactByPartyRows || [];
  const safeDirectEraRows = directImpactByEraRows || [];
  const safeTopPolicies = topPolicies || [];
  const safeRollbackRows = rollbackRows || [];
  const safeFutureBills = futureBills || [];

  const strongestParty = getTopRow(safePartyRows, "net_weighted_impact");
  const strongestEra = getTopRow(safeEraRows, "net_weighted_impact");
  const strongestCategory = getTopRow(safeCategoryRows, "net_weighted_impact");
  const highestDirectParty = getTopRow(safeDirectPartyRows, "direct_black_impact_count");

  const topParties = sortRows(safePartyRows, "net_weighted_impact").slice(0, 5);
  const topEras = sortRows(safeEraRows, "net_weighted_impact").slice(0, 5);
  const topCategories = sortRows(safeCategoryRows, "avg_policy_impact_score").slice(0, 6);
  const partyImpactRows = chartRows(safePartyRows, "net_weighted_impact");
  const partyDirectionRows = chartRows(safePartyRows, "positive_count");
  const directPartyRows = chartRows(safeDirectPartyRows, "direct_black_impact_count");
  const categoryScoreRows = chartRows(safeCategoryRows, "avg_policy_impact_score");
  const categoryImpactRows = chartRows(safeCategoryRows, "net_weighted_impact");
  const recentAccountability = [...safeFutureBills]
    .filter((bill) => bill.latest_tracked_update)
    .sort((a, b) => String(b.latest_tracked_update).localeCompare(String(a.latest_tracked_update)))
    .slice(0, 4);

  return (
    <div className="space-y-8">
      <section className="card-surface rounded-[1.6rem] p-5 md:p-6 space-y-4">
        <div className="section-intro">
          <h2 className="text-2xl font-semibold">Navigate the Report</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-2">
            Start with the headline findings, then move into party, era, category,
            and policy-level sections.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <JumpChip targetId="report-overview" label="Overview" />
          <JumpChip targetId="report-parties" label="Parties" />
          <JumpChip targetId="report-eras" label="Eras" />
          <JumpChip targetId="report-categories" label="Categories" />
          <JumpChip targetId="report-policies" label="Policies" />
        </div>
      </section>

      <section id="report-overview" className="space-y-4 scroll-mt-24">
        <div>
          <h2 className="text-2xl font-semibold">Overview</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            High-level metrics summarizing the current policy dataset.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard title="Total Policies" value={safeOverall.total_policies ?? 0} />
          <StatCard
            title="Direct Black Impact Policies"
            value={safeOverall.direct_black_impact_count ?? 0}
          />
          <StatCard
            title="Average Policy Impact Score"
            value={safeOverall.avg_policy_impact_score ?? 0}
          />
          <StatCard
            title="Net Weighted Impact"
            value={safeOverall.net_weighted_impact ?? 0}
          />
          <StatCard title="Positive Policies" value={safeOverall.positive_count ?? 0} />
          <StatCard title="Negative Policies" value={safeOverall.negative_count ?? 0} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <FindingCard
          eyebrow="Headline"
          title={
            strongestParty
              ? `${strongestParty.name} has the highest net weighted impact`
              : "Party findings unavailable"
          }
          body={
            strongestParty
              ? `${strongestParty.name} currently leads this dataset with a net weighted impact of ${formatNumber(strongestParty.net_weighted_impact)}. This is descriptive of the current records, not a claim that party labels mean the same thing across all eras.`
              : "There is not enough party summary data to produce a headline finding yet."
          }
        />

        <FindingCard
          eyebrow="Historical Pattern"
          title={
            strongestEra
              ? `${strongestEra.name} shows the strongest cumulative impact`
              : "Era findings unavailable"
          }
          body={
            strongestEra
              ? `${strongestEra.name} has the highest net weighted impact in the current dataset, while ${highestDirectParty?.name || "the leading party grouping"} has the largest count of direct Black impact policies. Together, those measures help distinguish broad accumulated effect from explicitly targeted policy activity.`
              : "There is not enough era summary data to produce a historical pattern finding yet."
          }
        />

        <FindingCard
          eyebrow="Category"
          title={
            strongestCategory
              ? `${strongestCategory.name} stands out as the strongest category`
              : "Category findings unavailable"
          }
          body={
            strongestCategory
              ? `${strongestCategory.name} leads on net weighted impact, and the top category average score is ${formatNumber(topCategories[0]?.avg_policy_impact_score ?? 0)}. This helps show where the strongest documented gains or losses are clustering across issue areas.`
              : "There is not enough category data to produce a category finding yet."
          }
        />

        <FindingCard
          eyebrow="Interpretation"
          title="The dashboard is strongest when read section by section"
          body="Read the party, era, and category sections as different lenses on the same policy corpus. A high total count does not always mean a high average score, and a strong net effect can coexist with substantial negative or blocked records in the same grouping."
        />
      </section>

      {recentAccountability.length > 0 ? (
        <SectionShell
          id="report-activity"
          eyebrow="Cross-Site Activity"
          title="Recent Accountability Activity"
          description="Recent movement in linked future bills, with direct pathways into tracked legislation and legislator scorecards."
        >
          <div className="mb-4">
            <Link href="/activity" className="accent-link text-sm">
              Open dedicated activity feed
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {recentAccountability.map((bill) => (
              <Link
                key={`activity-${bill.id}`}
                href="/activity"
                className="panel-link block rounded-[1.5rem] p-5"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold">{bill.title}</h3>
                    <p className="text-sm text-[var(--ink-soft)] mt-1">
                      {[bill.target_area, bill.priority_level, bill.status].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                    <span className="public-pill">
                      {formatDate(bill.latest_tracked_update)}
                    </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
                  <span className="public-pill">
                    Linked Bills: {bill.tracked_bills?.length || 0}
                  </span>
                  <span className="public-pill">
                    Scorecards: {bill.linked_legislators?.length || 0}
                  </span>
                  <span className="public-pill">
                    Explainers: {bill.related_explainers?.length || 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </SectionShell>
      ) : null}

      <SectionShell
        id="report-parties"
        eyebrow="Political Lens"
        title="Party Analysis"
        description="This section compares party-associated records across overall net impact, direction mix, and direct Black impact. It is best read as a historical grouping view, not a timeless ideological ranking."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
          <ChartShell
            title="Net Weighted Impact by Party"
            description="Shows the cumulative weighted impact of policies grouped by primary party."
            height={360}
            minWidth={700}
            ready={mounted}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partyImpactRows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid {...PUBLIC_CHART_GRID_PROPS} />
                <XAxis dataKey="name" {...PUBLIC_CHART_AXIS_PROPS} />
                <YAxis {...PUBLIC_CHART_AXIS_PROPS} />
                <Tooltip content={<PublicChartTooltip />} />
                <Legend {...PUBLIC_CHART_LEGEND_PROPS} />
                <Bar dataKey="net_weighted_impact" name="Net Weighted Impact" {...getPublicBarProps(PUBLIC_CHART_COLORS.primary)} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>

          <RankingList
            title="Top Parties by Net Impact"
            description="Fast comparison of the strongest party-associated groupings in the current dataset."
            rows={topParties}
            labelKey="name"
            valueKey="net_weighted_impact"
            valueLabel="Net impact"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartShell
            title="Policy Direction by Party"
            description="Breaks down party-associated policies by positive, mixed, negative, and blocked outcomes."
            height={360}
            minWidth={700}
            ready={mounted}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partyDirectionRows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid {...PUBLIC_CHART_GRID_PROPS} />
                <XAxis dataKey="name" {...PUBLIC_CHART_AXIS_PROPS} />
                <YAxis allowDecimals={false} {...PUBLIC_CHART_AXIS_PROPS} />
                <Tooltip content={<PublicChartTooltip />} />
                <Legend {...PUBLIC_CHART_LEGEND_PROPS} />
                <Bar dataKey="positive_count" name="Positive" {...getPublicBarProps(PUBLIC_CHART_COLORS.positive)} />
                <Bar dataKey="mixed_count" name="Mixed" {...getPublicBarProps(PUBLIC_CHART_COLORS.warning)} />
                <Bar dataKey="negative_count" name="Negative" {...getPublicBarProps(PUBLIC_CHART_COLORS.negative)} />
                <Bar dataKey="blocked_impact_count" name="Blocked" {...getPublicBarProps(PUBLIC_CHART_COLORS.blocked)} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>

          <ChartShell
            title="Direct Black Impact by Party"
            description="Compares how many policies in each party grouping were marked as directly affecting Black communities."
            height={360}
            minWidth={700}
            ready={mounted}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={directPartyRows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid {...PUBLIC_CHART_GRID_PROPS} />
                <XAxis dataKey="name" {...PUBLIC_CHART_AXIS_PROPS} />
                <YAxis allowDecimals={false} {...PUBLIC_CHART_AXIS_PROPS} />
                <Tooltip content={<PublicChartTooltip />} />
                <Legend {...PUBLIC_CHART_LEGEND_PROPS} />
                <Bar
                  dataKey="direct_black_impact_count"
                  name="Direct Black Impact Policies"
                  {...getPublicBarProps(PUBLIC_CHART_COLORS.primary)}
                />
                <Bar dataKey="total_policies" name="Total Policies" {...getPublicBarProps(PUBLIC_CHART_COLORS.neutral)} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>
      </SectionShell>

      <SectionShell
        id="report-eras"
        eyebrow="Historical Lens"
        title="Era Analysis"
        description="These charts show how policy effects cluster across major historical periods. This helps separate long-term eras of expansion, retrenchment, mixed reform, and blocked change."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
          <ChartShell
            title="Net Weighted Impact by Era"
            description="Shows how policy effects accumulate across major historical eras."
            height={420}
            minWidth={950}
            ready={mounted}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeEraRows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid {...PUBLIC_CHART_GRID_PROPS} />
                <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={90} {...PUBLIC_CHART_AXIS_PROPS} />
                <YAxis {...PUBLIC_CHART_AXIS_PROPS} />
                <Tooltip content={<PublicChartTooltip />} />
                <Legend {...PUBLIC_CHART_LEGEND_PROPS} />
                <Bar dataKey="net_weighted_impact" name="Net Weighted Impact" {...getPublicBarProps(PUBLIC_CHART_COLORS.primary)} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>

          <RankingList
            title="Top Eras by Net Impact"
            description="The strongest cumulative periods in the current research set."
            rows={topEras}
            labelKey="name"
            valueKey="net_weighted_impact"
            valueLabel="Net impact"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartShell
            title="Policy Direction by Era"
            description="Compares the mix of positive, negative, mixed, and blocked outcomes within each historical era."
            height={420}
            minWidth={950}
            ready={mounted}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeEraRows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid {...PUBLIC_CHART_GRID_PROPS} />
                <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={90} {...PUBLIC_CHART_AXIS_PROPS} />
                <YAxis allowDecimals={false} {...PUBLIC_CHART_AXIS_PROPS} />
                <Tooltip content={<PublicChartTooltip />} />
                <Legend {...PUBLIC_CHART_LEGEND_PROPS} />
                <Bar dataKey="positive_count" name="Positive" {...getPublicBarProps(PUBLIC_CHART_COLORS.positive)} />
                <Bar dataKey="mixed_count" name="Mixed" {...getPublicBarProps(PUBLIC_CHART_COLORS.warning)} />
                <Bar dataKey="negative_count" name="Negative" {...getPublicBarProps(PUBLIC_CHART_COLORS.negative)} />
                <Bar dataKey="blocked_impact_count" name="Blocked" {...getPublicBarProps(PUBLIC_CHART_COLORS.blocked)} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>

          <ChartShell
            title="Direct Black Impact by Era"
            description="Shows how many policies in each era were classified as directly affecting Black communities."
            height={420}
            minWidth={950}
            ready={mounted}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeDirectEraRows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid {...PUBLIC_CHART_GRID_PROPS} />
                <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={90} {...PUBLIC_CHART_AXIS_PROPS} />
                <YAxis allowDecimals={false} {...PUBLIC_CHART_AXIS_PROPS} />
                <Tooltip content={<PublicChartTooltip />} />
                <Legend {...PUBLIC_CHART_LEGEND_PROPS} />
                <Bar
                  dataKey="direct_black_impact_count"
                  name="Direct Black Impact Policies"
                  {...getPublicBarProps(PUBLIC_CHART_COLORS.primary)}
                />
                <Bar dataKey="total_policies" name="Total Policies" {...getPublicBarProps(PUBLIC_CHART_COLORS.neutral)} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>
      </SectionShell>

      <SectionShell
        id="report-categories"
        eyebrow="Issue Lens"
        title="Category Analysis"
        description="Category reports show where the strongest patterns cluster across issues like voting rights, housing, education, labor, and criminal justice."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
          <ChartShell
            title="Average Policy Impact Score by Category"
            description="Compares average structured impact scores across policy categories."
            height={420}
            minWidth={950}
            ready={mounted}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryScoreRows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid {...PUBLIC_CHART_GRID_PROPS} />
                <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={110} {...PUBLIC_CHART_AXIS_PROPS} />
                <YAxis {...PUBLIC_CHART_AXIS_PROPS} />
                <Tooltip content={<PublicChartTooltip />} />
                <Legend {...PUBLIC_CHART_LEGEND_PROPS} />
                <Bar dataKey="avg_policy_impact_score" name="Avg Policy Impact Score" {...getPublicBarProps(PUBLIC_CHART_COLORS.secondary)} />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>

          <RankingList
            title="Top Categories by Average Score"
            description="Useful for seeing which issue areas carry the strongest average documented impact."
            rows={topCategories}
            labelKey="name"
            valueKey="avg_policy_impact_score"
            valueLabel="Average score"
          />
        </div>

        <ChartShell
          title="Net Weighted Impact by Category"
          description="Shows the cumulative weighted effect of policies grouped by category."
          height={420}
          minWidth={950}
          ready={mounted}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryImpactRows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid {...PUBLIC_CHART_GRID_PROPS} />
              <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={110} {...PUBLIC_CHART_AXIS_PROPS} />
              <YAxis {...PUBLIC_CHART_AXIS_PROPS} />
              <Tooltip content={<PublicChartTooltip />} />
              <Legend {...PUBLIC_CHART_LEGEND_PROPS} />
              <Bar dataKey="net_weighted_impact" name="Net Weighted Impact" {...getPublicBarProps(PUBLIC_CHART_COLORS.primary)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </SectionShell>

      <SectionShell
        id="report-policies"
        eyebrow="Record Lens"
        title="Policy-Level Highlights"
        description="These are the records worth reading after the broader charts. One list surfaces the strongest positive policies. The other surfaces important rollbacks, mixed outcomes, and blocked efforts."
      >
        <section className="space-y-4">
          <div>
            <h3 className="text-2xl font-semibold">Top Positive Policies</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-1">
              Policies with the strongest positive composite scores in the dataset.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {safeTopPolicies.slice(0, 10).map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                titleLabel="Total Score"
                titleValue={formatNumber(policy.total_score ?? 0)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-2xl font-semibold">Rollbacks, Mixed, and Blocked</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-1">
              Policies with negative, mixed, or blocked outcomes that matter for understanding reversals, limits, and missed reforms.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {safeRollbackRows.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                titleLabel="Impact Direction"
                titleValue={policy.impact_direction || "Unknown"}
              />
            ))}
          </div>
        </section>
      </SectionShell>
    </div>
  );
}
