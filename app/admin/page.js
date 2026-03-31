import Link from "next/link";
import { getCommandCenterSummary } from "@/lib/server/admin-operator/workflowData.js";
import ActionLauncher from "./components/ActionLauncher";
import OperatorActionButton from "./components/OperatorActionButton";
import OperatorPageAutoRefresh from "./components/OperatorPageAutoRefresh";
import JobStatusBadge from "./jobs/JobStatusBadge";

export const dynamic = "force-dynamic";

const EMPTY_BUCKET = {
  title: "No items",
  description: "",
  items: [],
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toWorkflowLabel(value) {
  if (value === "current-admin") {
    return "Current Admin";
  }
  if (value === "legislative") {
    return "Legislative";
  }
  if (value === "system") {
    return "System";
  }
  return value || "Unknown";
}

function toPriorityCode(label) {
  if (label === "critical" || label === "high") {
    return "P1";
  }
  if (label === "medium") {
    return "P2";
  }
  return "P3";
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) {
    return "—";
  }

  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "—";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function CompactBadge({ children, tone = "default", mono = false }) {
  const palette =
    tone === "danger"
      ? "border-red-300 bg-red-50 text-red-900"
      : tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : tone === "success"
          ? "border-green-300 bg-green-50 text-green-900"
          : "border-zinc-300 bg-zinc-50 text-zinc-700";

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${palette}${mono ? " font-mono" : " font-medium"}`}
    >
      {children}
    </span>
  );
}

function StateBadge({ value }) {
  const text = normalizeString(value) || "unknown";
  const upper = text.toUpperCase();
  const tone =
    upper.includes("BLOCK") || upper === "FAILED" || upper === "MISSING"
      ? "danger"
      : upper.includes("REVIEW") || upper.includes("QUEUE") || upper === "QUEUED"
        ? "warning"
        : upper.includes("READY") || upper === "SUCCESS" || upper === "RUNNING"
          ? "success"
          : "default";

  return <CompactBadge tone={tone}>{text}</CompactBadge>;
}

function RoutineTypeBadge({ step }) {
  let label = "Run";
  if (step.executionSafety.blocked) {
    label = "Blocked";
  } else if (step.executionSafety.requires_review) {
    label = "Review";
  } else if (step.actionType === "retry_safely") {
    label = "Retry";
  } else if (step.sourceType === "schedule") {
    label = "Schedule";
  }

  const tone =
    label === "Blocked"
      ? "danger"
      : label === "Review"
        ? "warning"
        : label === "Run"
          ? "success"
          : "default";

  return <CompactBadge tone={tone}>{label}</CompactBadge>;
}

function DashboardCounter({ label, value, href }) {
  return (
    <Link
      href={href}
      className="flex min-h-0 items-center justify-between gap-3 rounded border border-zinc-300 bg-white px-2 py-1.5 text-[11px] hover:bg-zinc-50"
    >
      <span className="font-mono uppercase tracking-wide text-zinc-600">{label}</span>
      <span className="text-sm font-semibold text-zinc-900">{value}</span>
    </Link>
  );
}

function TableShell({ children }) {
  return (
    <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
      {children}
    </div>
  );
}

function TableLink({ href, children }) {
  return (
    <Link href={href} className="text-[11px] underline underline-offset-2">
      {children}
    </Link>
  );
}

function renderPrimaryAction(actionConfig, fallbackHref, fallbackLabel = "Inspect") {
  if (actionConfig?.type === "action" && actionConfig.action) {
    return (
      <OperatorActionButton
        action={actionConfig.action}
        label={actionConfig.label}
        input={actionConfig.input}
        context={actionConfig.context}
        tone={actionConfig.tone}
        helperText=""
        confirmation={actionConfig.confirmation}
      />
    );
  }

  if (actionConfig?.type === "link" && actionConfig.href) {
    return (
      <TableLink href={actionConfig.href}>
        {actionConfig.label}
      </TableLink>
    );
  }

  if (fallbackHref) {
    return <TableLink href={fallbackHref}>{fallbackLabel}</TableLink>;
  }

  return <span className="text-[11px] text-zinc-400">—</span>;
}

function SectionHeader({ eyebrow, title, description, href, hrefLabel = "View all" }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-600">{eyebrow}</p>
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {description ? <p className="text-[11px] text-zinc-600">{description}</p> : null}
      </div>
      {href ? <TableLink href={href}>{hrefLabel}</TableLink> : null}
    </div>
  );
}

function DailyRoutineTable({ steps, itemIndex }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="Daily Routine"
        title="Top sequenced operator work"
        description="Only the highest-value first-wave steps are shown here."
      />
      <TableShell>
        <table className="min-w-[1160px] w-full text-[11px]">
          <thead className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Priority</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Type</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Item</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Why Now</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">State</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Source</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {steps.length ? (
              steps.map((step) => {
                const sourceItem = itemIndex.get(step.sourceItemId);
                return (
                  <tr key={step.id} className="align-top odd:bg-white even:bg-zinc-50/40">
                    <td className="border-b border-zinc-200 px-2 py-1 font-mono font-medium text-zinc-700">
                      {toPriorityCode(step.priorityLabel)}
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      <RoutineTypeBadge step={step} />
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">{toWorkflowLabel(step.workflowFamily)}</td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      <div className="font-medium text-zinc-900">{step.title}</div>
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1 text-zinc-700">
                      {step.priorityReason || step.explanation}
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      <StateBadge value={sourceItem?.status || "pending"} />
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1 font-mono text-[10px] text-zinc-600">
                      {step.sourceId}
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      {renderPrimaryAction(step.primaryAction, step.deepLinkTarget, "Open")}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-2 py-3 text-[11px] text-zinc-600">
                  No routine items are active right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function BucketTable({ id, title, description, href, items }) {
  const rows = items.slice(0, 4);

  return (
    <section id={id} className="space-y-2">
      <SectionHeader eyebrow={title} title={title} description={description} href={href} />
      <TableShell>
        <table className="min-w-[760px] w-full text-[11px]">
          <thead className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Item</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Why Now</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">State</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((item) => (
                <tr key={item.id} className="align-top odd:bg-white even:bg-zinc-50/40">
                  <td className="border-b border-zinc-200 px-2 py-1">{toWorkflowLabel(item.workflowFamily)}</td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <div className="font-medium text-zinc-900">{item.title}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                      {item.metadata?.sourceId || item.id}
                    </div>
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1 text-zinc-700">
                    {item.priorityReason || item.summary}
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <StateBadge value={item.status || "pending"} />
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    {item.quickAction?.action ? (
                      <OperatorActionButton
                        action={item.quickAction.action}
                        label={item.quickAction.label}
                        input={item.quickAction.input}
                        context={item.quickAction.context}
                        tone={item.quickAction.tone}
                        helperText=""
                        confirmation={item.quickAction.confirmation}
                      />
                    ) : item.href ? (
                      <TableLink href={item.href}>Inspect</TableLink>
                    ) : (
                      <span className="text-[11px] text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-2 py-3 text-[11px] text-zinc-600">
                  Nothing active in this bucket right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function SessionSnapshotTable({ sessions }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="Session Snapshots"
        title="Active workflow sessions"
        description="This is the spreadsheet backbone of the command center."
        href="/admin/workflows"
      />
      <TableShell>
        <table className="min-w-[1380px] w-full text-[11px]">
          <thead className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Session</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">State</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Review</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Blocker</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Next Action</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Latest Job</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Mode</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Schedule</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Fallback</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length ? (
              sessions.slice(0, 8).map((session) => {
                const blocker =
                  session.blockerPreview?.[0] ||
                  session.missingArtifactsPreview?.[0] ||
                  "—";
                const primaryAction =
                  session.quickActions?.nextAction ||
                  session.quickActions?.retryAction ||
                  null;

                return (
                  <tr key={session.id} className="align-top odd:bg-white even:bg-zinc-50/40">
                    <td className="border-b border-zinc-200 px-2 py-1">{toWorkflowLabel(session.workflowFamily)}</td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      <div className="font-mono text-[10px] text-zinc-700">
                        {session.canonicalSessionKey || session.id}
                      </div>
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      <StateBadge value={session.canonicalState} />
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      {session.reviewPendingCount > 0 ? (
                        <CompactBadge tone="warning">Yes</CompactBadge>
                      ) : (
                        <CompactBadge>No</CompactBadge>
                      )}
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      <div className="max-w-[220px] truncate text-zinc-700" title={blocker}>
                        {blocker}
                      </div>
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      <div className="max-w-[180px] truncate text-zinc-700" title={session.recommendedAction?.title || ""}>
                        {session.recommendedAction?.title || "—"}
                      </div>
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      {session.lastJob ? (
                        <div className="space-y-1">
                          <JobStatusBadge status={session.lastJob.status} />
                          <div className="font-mono text-[10px] text-zinc-600">
                            {session.lastJob.id}
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1 font-mono text-[10px] text-zinc-700">
                      {session.execution?.execution_mode || "local_cli"}
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1 font-mono text-[10px] text-zinc-700">
                      {session.linkedSchedule?.title || "—"}
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      {session.fallbackPreview ? <CompactBadge tone="warning">Yes</CompactBadge> : <CompactBadge>No</CompactBadge>}
                    </td>
                    <td className="border-b border-zinc-200 px-2 py-1">
                      {primaryAction ? (
                        <OperatorActionButton
                          action={primaryAction.action}
                          label={primaryAction.title}
                          input={primaryAction.input}
                          context={primaryAction.context}
                          tone={primaryAction.tone}
                          helperText=""
                          confirmation={primaryAction.confirmation}
                        />
                      ) : (
                        <TableLink href={session.href}>Open</TableLink>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} className="px-2 py-3 text-[11px] text-zinc-600">
                  No active sessions are currently recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function SchedulesTable({ schedules }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="Schedules"
        title="Preparation timing"
        description="Schedules stay lower on the page and do not outrank urgent human work."
        href="/admin/schedules"
      />
      <TableShell>
        <table className="min-w-[980px] w-full text-[11px]">
          <thead className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Title</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Action</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Workflow</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Mode</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Status</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Next Run</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Last Run</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Last Result</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length ? (
              schedules.slice(0, 5).map((schedule) => (
                <tr key={schedule.id} className="align-top odd:bg-white even:bg-zinc-50/40">
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <div className="font-medium">{schedule.title}</div>
                    <div className="font-mono text-[10px] text-zinc-500">{schedule.id}</div>
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    {schedule.action?.title || schedule.actionId}
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">{toWorkflowLabel(schedule.workflowFamily)}</td>
                  <td className="border-b border-zinc-200 px-2 py-1 font-mono text-[10px] text-zinc-700">
                    {schedule.executionMode || "local_cli"}
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <StateBadge value={schedule.status} />
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">{formatDateTime(schedule.nextRunAt)}</td>
                  <td className="border-b border-zinc-200 px-2 py-1">{formatDateTime(schedule.lastRunAt)}</td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <div className="max-w-[220px] truncate text-zinc-700" title={schedule.lastJob?.summary || schedule.lastResultSummary || schedule.summary}>
                      {schedule.lastJob?.summary || schedule.lastResultSummary || schedule.summary}
                    </div>
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <TableLink href="/admin/schedules">Open schedule</TableLink>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-2 py-3 text-[11px] text-zinc-600">
                  No schedules are currently recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function HealthTable({ banner, signals }) {
  return (
    <section className="space-y-2">
      <SectionHeader
        eyebrow="System Health"
        title="Verification and active signals"
        description="Keep this lower than urgent workflow work, but make drift visible."
        href="/admin/tools"
      />
      <TableShell>
        <table className="min-w-[860px] w-full text-[11px]">
          <thead className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Check</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Status</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Summary</th>
              <th className="border-b border-zinc-200 px-2 py-1 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {banner ? (
              <tr className="align-top odd:bg-white even:bg-zinc-50/40">
                <td className="border-b border-zinc-200 px-2 py-1 font-medium">{banner.title}</td>
                <td className="border-b border-zinc-200 px-2 py-1">
                  <StateBadge value={banner.status} />
                </td>
                <td className="border-b border-zinc-200 px-2 py-1 text-zinc-700">
                  {banner.summary}
                </td>
                <td className="border-b border-zinc-200 px-2 py-1">
                  <TableLink href={banner.href || "/admin/tools"}>Open tools</TableLink>
                </td>
              </tr>
            ) : null}
            {signals.slice(0, 4).map((signal) => (
              <tr key={signal.id} className="align-top odd:bg-white even:bg-zinc-50/40">
                <td className="border-b border-zinc-200 px-2 py-1 font-medium">{signal.title}</td>
                <td className="border-b border-zinc-200 px-2 py-1">
                  <StateBadge value={signal.signalType} />
                </td>
                <td className="border-b border-zinc-200 px-2 py-1 text-zinc-700">{signal.summary}</td>
                <td className="border-b border-zinc-200 px-2 py-1">
                  {signal.href ? <TableLink href={signal.href}>Inspect</TableLink> : <TableLink href="/admin/tools">Open tools</TableLink>}
                </td>
              </tr>
            ))}
            {!banner && !signals.length ? (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-[11px] text-zinc-600">
                  No verification or signal warnings are active right now.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

export default async function AdminPage() {
  let summary;
  let loadError = "";

  try {
    summary = await getCommandCenterSummary();
  } catch (error) {
    console.error("admin dashboard summary load failed:", error);
    loadError =
      error instanceof Error
        ? error.message
        : "The dashboard summary could not be assembled.";
    summary = {
      verificationBanner: null,
      overview: {
        blockedSessions: 0,
        readyToRun: 0,
        overdueSchedules: 0,
        recentFailures: 0,
      },
      reviewQueueSummary: {
        pendingReviewItems: 0,
      },
      dailyRoutine: { steps: [] },
      buckets: {},
      sessionCards: [],
      schedulesNeedingAttention: [],
      upcomingSchedules: [],
      signals: [],
      recentJobs: [],
      featuredActions: [],
    };
  }

  const buckets = summary.buckets || {};
  const blockedBucket = buckets.blockedNeedsFix || EMPTY_BUCKET;
  const reviewBucket = buckets.awaitingHumanReview || EMPTY_BUCKET;
  const readyBucket = buckets.readyToRun || EMPTY_BUCKET;
  const failureBucket = buckets.recentFailures || EMPTY_BUCKET;
  const allBucketItems = Object.values(buckets).flatMap((bucket) => bucket?.items || []);
  const itemIndex = new Map(allBucketItems.map((item) => [item.id, item]));
  const runningJobs = (summary.recentJobs || []).filter((job) => ["queued", "running"].includes(job.status)).length;
  const schedules = [
    ...(summary.schedulesNeedingAttention || []),
    ...((summary.upcomingSchedules || []).filter(
      (candidate) => !(summary.schedulesNeedingAttention || []).some((item) => item.id === candidate.id)
    )),
  ].slice(0, 5);

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <OperatorPageAutoRefresh />

      <section className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-600">Operator Dashboard</p>
        <h1 className="text-lg font-semibold text-zinc-900">What needs attention right now</h1>
        <p className="text-[11px] text-zinc-600">
          This page is optimized for triage, next action, and safe progression through broker-backed operator work.
        </p>
      </section>

      {loadError ? (
        <section className="rounded border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-950">
          <div className="font-medium">Dashboard fallback</div>
          <p className="mt-1">{loadError}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <TableLink href="/admin/tools">Open tools</TableLink>
            <TableLink href="/admin/jobs">Open jobs</TableLink>
            <TableLink href="/admin/workflows">Open sessions</TableLink>
            <TableLink href="/admin/command">Open command console</TableLink>
          </div>
        </section>
      ) : null}

      <section className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <DashboardCounter label="Blocked" value={summary.overview.blockedSessions} href="#blocked-needs-fix" />
        <DashboardCounter label="Needs Review" value={summary.reviewQueueSummary.pendingReviewItems} href="#awaiting-human-review" />
        <DashboardCounter label="Ready Now" value={summary.overview.readyToRun} href="#ready-to-run" />
        <DashboardCounter label="Failed Jobs" value={summary.overview.recentFailures} href="#recent-failures" />
        <DashboardCounter label="Overdue Schedules" value={summary.overview.overdueSchedules} href="/admin/schedules" />
        <DashboardCounter label="Running Jobs" value={runningJobs} href="/admin/jobs" />
      </section>

      <DailyRoutineTable
        steps={(summary.dailyRoutine?.steps || []).slice(0, 5)}
        itemIndex={itemIndex}
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <BucketTable
          id="blocked-needs-fix"
          title="Blocked / Needs Fix"
          description="Inspect blockers before lower-priority ready work."
          href="/admin/workflows"
          items={blockedBucket.items || []}
        />
        <BucketTable
          id="awaiting-human-review"
          title="Awaiting Human Review"
          description="Human checkpoints that cannot be automated."
          href="/admin/review-queue"
          items={reviewBucket.items || []}
        />
        <BucketTable
          id="ready-to-run"
          title="Ready To Run"
          description="Safe next-step work that can be run now."
          href="/admin/workflows"
          items={readyBucket.items || []}
        />
        <BucketTable
          id="recent-failures"
          title="Recent Failures"
          description="Recent blocked or failed broker jobs that may need inspection or retry."
          href="/admin/jobs"
          items={failureBucket.items || []}
        />
      </section>

      <SessionSnapshotTable sessions={summary.sessionCards || []} />

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SchedulesTable schedules={schedules} />
        <HealthTable
          banner={summary.verificationBanner}
          signals={summary.signals || []}
        />
      </section>

      <ActionLauncher
        title="Quick launch"
        description="Use this when you already know the safe next wrapped action."
        allowedActionIds={[
          "currentAdmin.run",
          "currentAdmin.review",
          "currentAdmin.apply",
          "legislative.run",
        ]}
        buttonLabel="Start action"
        compact
      />
    </main>
  );
}
