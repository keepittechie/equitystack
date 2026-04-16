"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";
import { SOURCE_TYPES } from "@/lib/admin/promiseValidation";

const SOURCE_CURATION_ENDPOINTS = [
  "/api/admin/source-curation",
  "/admin/source-curation/api",
];

async function fetchSourceCurationJson(path = "", init = {}) {
  let lastError = null;

  for (const endpoint of SOURCE_CURATION_ENDPOINTS) {
    const url = `${endpoint}${path}`;
    const headers = {
      Accept: "application/json",
      ...(init.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...init,
        headers,
      });
      const payload = await readAdminJsonResponse(response, url);

      if (
        !response.ok &&
        (response.status === 401 || response.status === 403) &&
        endpoint !== SOURCE_CURATION_ENDPOINTS[SOURCE_CURATION_ENDPOINTS.length - 1]
      ) {
        lastError = new Error(payload.error || `Authentication failed for ${url}.`);
        continue;
      }

      return { response, payload, endpoint: url };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Source-curation request failed.");
}

function CompactBadge({ tone = "neutral", children }) {
  const classes =
    tone === "danger"
      ? "border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] text-[var(--danger)]"
      : tone === "warning"
        ? "border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] text-[var(--warning)]"
        : tone === "success"
          ? "border-[var(--admin-success-line)] bg-[var(--admin-success-surface)] text-[var(--success)]"
          : "border-[var(--admin-line)] bg-[var(--admin-surface-muted)] text-[var(--admin-text-soft)]";

  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${classes}`}>
      {children}
    </span>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] shadow-sm">
      <div className="border-b border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--admin-text)]">{title}</h3>
        {description ? <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">{description}</p> : null}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function SummaryCard({ label, value, detail }) {
  return (
    <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-3 shadow-sm">
      <p className="text-[11px] text-[var(--admin-text-muted)]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[var(--admin-text)]">{value}</p>
      {detail ? <p className="mt-1 text-[11px] text-[var(--admin-text-soft)]">{detail}</p> : null}
    </div>
  );
}

function ActionButton({ children, onClick, disabled = false, tone = "neutral", title = "" }) {
  const classes =
    tone === "primary"
      ? "border-[var(--admin-link)] bg-[var(--admin-link)] text-[var(--background)] disabled:border-[var(--admin-line-strong)] disabled:bg-[var(--admin-line-strong)] disabled:text-[var(--admin-text-muted)]"
      : tone === "danger"
        ? "border-[var(--danger)] bg-[var(--danger)] text-[var(--foreground)] disabled:border-[var(--admin-danger-line)] disabled:bg-[var(--admin-danger-line)] disabled:text-[var(--admin-text-muted)]"
        : "border-[var(--admin-line-strong)] bg-[var(--admin-surface)] text-[var(--admin-text)] disabled:bg-[var(--admin-surface-soft)] disabled:text-[var(--admin-text-muted)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded border px-2 py-1 text-[11px] font-medium ${classes}`}
    >
      {children}
    </button>
  );
}

function buildInitialMissingDecisionMap(workspace) {
  const bucket = {};
  for (const group of workspace.missingSources.groups || []) {
    for (const item of group.items || []) {
      if (item.saved_decision) {
        bucket[item.review_key] = item.saved_decision;
      }
    }
  }
  return bucket;
}

function buildInitialDuplicateDecisionMap(workspace) {
  const bucket = {};
  for (const group of workspace.duplicates.groups || []) {
    for (const cluster of group.clusters || []) {
      if (cluster.saved_decision) {
        bucket[cluster.cluster_key] = cluster.saved_decision;
      }
    }
  }
  return bucket;
}

function buildInitialMissingDrafts(workspace) {
  const bucket = {};
  for (const group of workspace.missingSources.groups || []) {
    for (const item of group.items || []) {
      bucket[item.review_key] = {
        note: item.saved_decision?.note || "",
        selectedSource: item.saved_decision?.attachedSource || null,
        searchQuery: item.suggested_search_query || "",
        overrideDuplicateWarning: false,
        newSourceDraft: {
          source_title: "",
          source_url: "",
          source_type: "",
          publisher: "",
          published_date: "",
          notes: "",
        },
        searchResults: [],
        searchLoading: false,
        searchError: "",
        duplicateWarning: [],
      };
    }
  }
  return bucket;
}

function buildInitialDuplicateDrafts(workspace) {
  const bucket = {};
  for (const group of workspace.duplicates.groups || []) {
    for (const cluster of group.clusters || []) {
      bucket[cluster.cluster_key] = {
        note: cluster.saved_decision?.note || "",
        selectedSourceIds: [],
        canonicalSourceId: null,
      };
    }
  }
  return bucket;
}

function decisionSummary(decision) {
  if (!decision) {
    return null;
  }
  if (decision.actionType === "attach_existing_source") {
    return `Attached existing source #${decision.attachedSource?.id || "?"}`;
  }
  if (decision.actionType === "create_and_attach_source") {
    return `Created and attached source #${decision.createdSource?.id || "?"}`;
  }
  if (
    decision.actionType === "mark_missing_source_reviewed" ||
    decision.actionType === "mark_reviewed"
  ) {
    return "Marked reviewed";
  }
  if (decision.actionType === "merge_duplicate_sources") {
    return `Merged into #${decision.canonicalSourceId || "?"}`;
  }
  if (decision.actionType === "keep_duplicate_sources_separate") {
    return "Kept separate";
  }
  return "Marked reviewed";
}

function buildVisibleMissingGroups(workspace, savedDecisions, resolvedKeys) {
  return (workspace.missingSources.groups || [])
    .map((group) => ({
      ...group,
      items: (group.items || [])
        .filter((item) => !resolvedKeys.has(item.review_key))
        .map((item) => ({
          ...item,
          saved_decision: savedDecisions[item.review_key] || item.saved_decision || null,
        })),
    }))
    .filter((group) => group.items.length > 0);
}

function buildVisibleDuplicateGroups(workspace, savedDecisions, resolvedKeys) {
  return (workspace.duplicates.groups || [])
    .map((group) => ({
      ...group,
      clusters: (group.clusters || [])
        .filter((cluster) => !resolvedKeys.has(cluster.cluster_key))
        .map((cluster) => ({
          ...cluster,
          saved_decision: savedDecisions[cluster.cluster_key] || cluster.saved_decision || null,
        })),
    }))
    .filter((group) => group.clusters.length > 0);
}

function SourcePreviewList({ sources = [] }) {
  if (!sources.length) {
    return <span className="text-[var(--admin-text-muted)]">No related source context recorded.</span>;
  }

  return (
    <div className="space-y-1">
      {sources.map((source) => (
        <div key={source.id} className="text-[10px] text-[var(--admin-text-soft)]">
          <span className="font-medium text-[var(--admin-text)]">#{source.id}</span> {source.source_title}
          {source.publisher ? ` • ${source.publisher}` : ""}
        </div>
      ))}
    </div>
  );
}

export default function SourceCurationWorkspace({ workspace }) {
  const [activeTab, setActiveTab] = useState("missing");
  const [missingDecisions, setMissingDecisions] = useState(
    buildInitialMissingDecisionMap(workspace)
  );
  const [duplicateDecisions, setDuplicateDecisions] = useState(
    buildInitialDuplicateDecisionMap(workspace)
  );
  const [missingDrafts, setMissingDrafts] = useState(buildInitialMissingDrafts(workspace));
  const [duplicateDrafts, setDuplicateDrafts] = useState(
    buildInitialDuplicateDrafts(workspace)
  );
  const [activeMissingPanel, setActiveMissingPanel] = useState({});
  const [activeDuplicatePanel, setActiveDuplicatePanel] = useState({});
  const [resolvedMissingKeys, setResolvedMissingKeys] = useState(new Set());
  const [resolvedDuplicateKeys, setResolvedDuplicateKeys] = useState(new Set());
  const [confirmationState, setConfirmationState] = useState(null);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const visibleMissingGroups = useMemo(
    () =>
      buildVisibleMissingGroups(workspace, missingDecisions, resolvedMissingKeys),
    [workspace, missingDecisions, resolvedMissingKeys]
  );
  const visibleDuplicateGroups = useMemo(
    () =>
      buildVisibleDuplicateGroups(workspace, duplicateDecisions, resolvedDuplicateKeys),
    [workspace, duplicateDecisions, resolvedDuplicateKeys]
  );

  const missingItemCount = visibleMissingGroups.reduce(
    (count, group) => count + group.items.length,
    0
  );
  const missingReviewedCount = visibleMissingGroups.reduce(
    (count, group) =>
      count + group.items.filter((item) => Boolean(item.saved_decision)).length,
    0
  );
  const duplicateClusterCount = visibleDuplicateGroups.reduce(
    (count, group) => count + group.clusters.length,
    0
  );
  const duplicateReviewedCount = visibleDuplicateGroups.reduce(
    (count, group) =>
      count + group.clusters.filter((cluster) => Boolean(cluster.saved_decision)).length,
    0
  );

  function clearMessages() {
    setMessage("");
    setErrorMessage("");
  }

  function updateMissingDraft(reviewKey, field, value) {
    setMissingDrafts((current) => ({
      ...current,
      [reviewKey]: {
        ...(current[reviewKey] || {}),
        [field]: value,
      },
    }));
  }

  function updateMissingNewSourceDraft(reviewKey, field, value) {
    setMissingDrafts((current) => ({
      ...current,
      [reviewKey]: {
        ...(current[reviewKey] || {}),
        newSourceDraft: {
          ...(current[reviewKey]?.newSourceDraft || {}),
          [field]: value,
        },
      },
    }));
  }

  function updateDuplicateDraft(clusterKey, field, value) {
    setDuplicateDrafts((current) => ({
      ...current,
      [clusterKey]: {
        ...(current[clusterKey] || {}),
        [field]: value,
      },
    }));
  }

  function toggleMissingPanel(reviewKey, panel) {
    clearMessages();
    setConfirmationState(null);
    setConfirmationChecked(false);
    setActiveMissingPanel((current) => ({
      ...current,
      [reviewKey]: current[reviewKey] === panel ? "" : panel,
    }));
  }

  function toggleDuplicatePanel(clusterKey, panel) {
    clearMessages();
    setConfirmationState(null);
    setConfirmationChecked(false);
    setActiveDuplicatePanel((current) => ({
      ...current,
      [clusterKey]: current[clusterKey] === panel ? "" : panel,
    }));
  }

  async function runSourceSearch(item) {
    const draft = missingDrafts[item.review_key] || {};
    clearMessages();
    updateMissingDraft(item.review_key, "searchLoading", true);
    updateMissingDraft(item.review_key, "searchError", "");
    updateMissingDraft(item.review_key, "duplicateWarning", []);

    try {
      const { response, payload } = await fetchSourceCurationJson(
        `?q=${encodeURIComponent(draft.searchQuery || item.suggested_search_query)}&limit=12&promiseId=${item.promise_id}${
          item.related_policy_id ? `&relatedPolicyId=${item.related_policy_id}` : ""
        }`,
        {
          method: "GET",
          cache: "no-store",
        }
      );
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to search existing sources.");
      }
      updateMissingDraft(item.review_key, "searchResults", payload.data?.results || []);
    } catch (error) {
      updateMissingDraft(item.review_key, "searchError", error.message);
      updateMissingDraft(item.review_key, "searchResults", []);
    } finally {
      updateMissingDraft(item.review_key, "searchLoading", false);
    }
  }

  function prepareMissingSourceAction(item, actionType) {
    const draft = missingDrafts[item.review_key] || {};
    clearMessages();

    if (actionType === "attach_existing_source") {
      if (!draft.selectedSource?.id) {
        setErrorMessage("Select an existing source before attaching it.");
        return;
      }
      setConfirmationState({
        entityType: "missing-source",
        key: item.review_key,
        title: "Attach existing source",
        description: `Attach source #${draft.selectedSource.id} to ${item.record_type} ${item.record_id}. This will update the canonical source join table and write an audit trail.`,
        payload: {
          actionType,
          reviewKey: item.review_key,
          selectedSourceId: draft.selectedSource.id,
          searchQuery: draft.searchQuery || item.suggested_search_query,
          note: draft.note || "",
          confirmed: true,
        },
      });
      return;
    }

    if (actionType === "create_and_attach_source") {
      const newSourceDraft = draft.newSourceDraft || {};
      if (!newSourceDraft.source_title || !newSourceDraft.source_url) {
        setErrorMessage("A source title and URL are required before creating a new source.");
        return;
      }
      setConfirmationState({
        entityType: "missing-source",
        key: item.review_key,
        title: "Create and attach source",
        description:
          "Create a new source row, attach it to this unresolved action/outcome, and log the manual curation decision.",
        payload: {
          actionType,
          reviewKey: item.review_key,
          newSourceDraft,
          note: draft.note || "",
          overrideDuplicateWarning: Boolean(draft.overrideDuplicateWarning),
          confirmed: true,
        },
      });
      return;
    }

    if (!(draft.note || "").trim()) {
      setErrorMessage("Add a short note before marking the row reviewed.");
      return;
    }
    setConfirmationState({
      entityType: "missing-source",
      key: item.review_key,
      title: "Mark missing-source row reviewed",
      description:
        "Record the operator review note without changing canonical source joins.",
      payload: {
        actionType: "mark_missing_source_reviewed",
        reviewKey: item.review_key,
        note: draft.note,
        confirmed: true,
      },
    });
  }

  function toggleClusterSelection(clusterKey, sourceId) {
    const current = duplicateDrafts[clusterKey] || {
      note: "",
      selectedSourceIds: [],
      canonicalSourceId: null,
    };
    const exists = current.selectedSourceIds.includes(sourceId);
    const selectedSourceIds = exists
      ? current.selectedSourceIds.filter((value) => value !== sourceId)
      : [...current.selectedSourceIds, sourceId];
    const canonicalSourceId = selectedSourceIds.includes(current.canonicalSourceId)
      ? current.canonicalSourceId
      : null;
    setDuplicateDrafts((drafts) => ({
      ...drafts,
      [clusterKey]: {
        ...current,
        selectedSourceIds,
        canonicalSourceId,
      },
    }));
  }

  function prepareDuplicateAction(cluster, actionType) {
    const draft = duplicateDrafts[cluster.cluster_key] || {
      note: "",
      selectedSourceIds: [],
      canonicalSourceId: null,
    };
    clearMessages();

    if (actionType === "merge_duplicate_sources") {
      if (draft.selectedSourceIds.length < 2) {
        setErrorMessage("Select at least two source rows before merging a duplicate cluster.");
        return;
      }
      if (!draft.canonicalSourceId) {
        setErrorMessage("Select one of the chosen rows as the canonical source to keep.");
        return;
      }
      setConfirmationState({
        entityType: "duplicate-cluster",
        key: cluster.cluster_key,
        title: "Merge selected duplicate sources",
        description:
          "This will preserve join-table relationships by moving selected references onto the canonical source row and deleting the chosen duplicate source rows.",
        payload: {
          actionType,
          clusterKey: cluster.cluster_key,
          selectedSourceIds: draft.selectedSourceIds,
          canonicalSourceId: draft.canonicalSourceId,
          note: draft.note || "",
          confirmed: true,
        },
      });
      return;
    }

    if (!(draft.note || "").trim()) {
      setErrorMessage("Add a short note before resolving a duplicate cluster.");
      return;
    }
    setConfirmationState({
      entityType: "duplicate-cluster",
      key: cluster.cluster_key,
      title:
        actionType === "keep_duplicate_sources_separate"
          ? "Keep duplicate sources separate"
          : "Mark duplicate cluster reviewed",
      description:
        actionType === "keep_duplicate_sources_separate"
          ? "Record that these source rows should remain separate and preserve the operator note."
          : "Record the review note without changing the duplicate cluster.",
      payload: {
        actionType,
        clusterKey: cluster.cluster_key,
        note: draft.note,
        confirmed: true,
      },
    });
  }

  function applySuccessfulResult(result) {
    if (result.entityType === "missing-source") {
      setMissingDecisions((current) => ({
        ...current,
        [result.decision.reviewKey]: result.decision,
      }));
      if (
        result.actionType === "attach_existing_source" ||
        result.actionType === "create_and_attach_source"
      ) {
        setResolvedMissingKeys((current) => new Set([...current, result.decision.reviewKey]));
      }
      return;
    }

    setDuplicateDecisions((current) => ({
      ...current,
      [result.decision.clusterKey]: result.decision,
    }));
    if (result.actionType === "merge_duplicate_sources") {
      setResolvedDuplicateKeys((current) => new Set([...current, result.decision.clusterKey]));
    }
  }

  function runConfirmedAction() {
    if (!confirmationState || !confirmationChecked) {
      return;
    }
    clearMessages();

    startTransition(async () => {
      try {
        const { response, payload } = await fetchSourceCurationJson("", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(confirmationState.payload),
        });
        if (!response.ok || !payload.success) {
          if (
            payload.errorDetails?.possibleDuplicates &&
            confirmationState.entityType === "missing-source"
          ) {
            updateMissingDraft(confirmationState.key, "duplicateWarning", payload.errorDetails.possibleDuplicates);
            updateMissingDraft(confirmationState.key, "overrideDuplicateWarning", false);
          }
          throw new Error(payload.error || "Source curation action failed.");
        }
        applySuccessfulResult(payload.data);
        setConfirmationState(null);
        setConfirmationChecked(false);
        setMessage(
          `${payload.data.actionType} completed. Audit trail written to ${payload.data.auditLogPath}.`
        );
      } catch (error) {
        setErrorMessage(error.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 lg:grid-cols-6">
        <SummaryCard
          label="Missing-source rows"
          value={missingItemCount}
          detail={`${missingReviewedCount} already reviewed in curation`}
        />
        <SummaryCard
          label="Duplicate clusters"
          value={duplicateClusterCount}
          detail={`${duplicateReviewedCount} already reviewed in curation`}
        />
        <SummaryCard
          label="Attribution artifact"
          value={workspace.artifacts.attribution.generatedAt ? "available" : "missing"}
          detail={workspace.artifacts.attribution.filePath}
        />
        <SummaryCard
          label="Duplicate artifact"
          value={workspace.artifacts.duplicates.generatedAt ? "available" : "missing"}
          detail={workspace.artifacts.duplicates.filePath}
        />
        <SummaryCard
          label="Decision state"
          value={
            workspace.decisions.missingSourceCount + workspace.decisions.duplicateClusterCount
          }
          detail={workspace.decisions.filePath}
        />
        <SummaryCard
          label="Audit log"
          value="append-only"
          detail={workspace.decisions.auditLogPath}
        />
      </section>

      {workspace.loadErrors.missingSource ? (
        <section className="rounded border border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] p-3 text-[11px] text-[var(--warning)]">
          Missing-source detail warning: {workspace.loadErrors.missingSource}
        </section>
      ) : null}
      {workspace.loadErrors.duplicates ? (
        <section className="rounded border border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] p-3 text-[11px] text-[var(--warning)]">
          Duplicate-cluster detail warning: {workspace.loadErrors.duplicates}
        </section>
      ) : null}

      {message ? (
        <section className="rounded border border-[var(--admin-success-line)] bg-[var(--admin-success-surface)] p-3 text-[11px] text-[var(--success)]">
          {message}
        </section>
      ) : null}
      {errorMessage ? (
        <section className="rounded border border-[var(--admin-danger-line)] bg-[var(--admin-danger-surface)] p-3 text-[11px] text-[var(--danger)]">
          {errorMessage}
        </section>
      ) : null}

      <section className="flex flex-wrap gap-2">
        <ActionButton
          tone={activeTab === "missing" ? "primary" : "neutral"}
          onClick={() => setActiveTab("missing")}
        >
          Missing Source Attribution
        </ActionButton>
        <ActionButton
          tone={activeTab === "duplicates" ? "primary" : "neutral"}
          onClick={() => setActiveTab("duplicates")}
        >
          Duplicate Source Review
        </ActionButton>
      </section>

      {activeTab === "missing" ? (
        <SectionCard
          title="Missing Source Attribution"
          description="Review unresolved action/outcome rows, inspect same-promise evidence, and explicitly attach or draft sources."
        >
          {!visibleMissingGroups.length ? (
            <p className="text-[12px] text-[var(--admin-text-soft)]">
              No unresolved missing-source records are pending.
            </p>
          ) : (
            <div className="space-y-4">
              {visibleMissingGroups.map((group) => (
                <section key={group.id} className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)]">
                  <div className="border-b border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                          {group.president_name}
                        </p>
                        <h4 className="text-sm font-semibold text-[var(--admin-text)]">{group.topic}</h4>
                        <p className="mt-1 text-[10px] text-[var(--admin-text-muted)]">
                          Import origin: {group.import_origin}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <CompactBadge>{group.items.length} row(s)</CompactBadge>
                        <CompactBadge tone="warning">
                          {
                            group.items.filter((item) => !item.saved_decision).length
                          }{" "}
                          pending
                        </CompactBadge>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[1720px] w-full text-[11px]">
                      <thead className="bg-[var(--admin-surface-muted)] text-left uppercase tracking-wide text-[var(--admin-text-muted)]">
                        <tr>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Promise</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Record</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Existing Source Context</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Reason</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Suggested Next Step</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Saved Decision</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => {
                          const draft = missingDrafts[item.review_key] || {};
                          const panel = activeMissingPanel[item.review_key] || "";
                          const savedDecision = missingDecisions[item.review_key] || item.saved_decision;

                          return (
                            <Fragment key={item.review_key}>
                              <tr key={item.review_key} className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)] hover:bg-[var(--admin-surface-soft)]">
                                <td className="border-b border-[var(--admin-line)] px-2 py-2">
                                  <div className="font-medium text-[var(--admin-text)]">{item.promise_title}</div>
                                  <div className="mt-0.5 font-mono text-[10px] text-[var(--admin-text-muted)]">
                                    {item.promise_slug}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Link href={`/promises/${item.promise_slug}`} className="text-[var(--admin-link)] underline">
                                      Open related promise
                                    </Link>
                                  </div>
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <CompactBadge tone="warning">{item.record_type}</CompactBadge>
                                    <CompactBadge tone="danger">missing source</CompactBadge>
                                    <span className="font-mono text-[10px] text-[var(--admin-text-muted)]">
                                      #{item.record_id}
                                    </span>
                                  </div>
                                  <div className="mt-1 font-medium text-[var(--admin-text)]">{item.record_text}</div>
                                  {item.record_detail ? (
                                    <div className="mt-1 max-w-[360px] text-[var(--admin-text-soft)]">{item.record_detail}</div>
                                  ) : null}
                                  {item.related_policy_title ? (
                                    <div className="mt-1 text-[10px] text-[var(--admin-text-muted)]">
                                      Related policy: {item.related_policy_title}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2">
                                  <div className="space-y-2">
                                    <div>
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                                        Same promise
                                      </div>
                                      <SourcePreviewList sources={item.existing_promise_sources || []} />
                                      <div className="mt-1 text-[10px] text-[var(--admin-text-muted)]">
                                        {item.existing_promise_source_count || 0} total same-promise source(s)
                                      </div>
                                    </div>
                                    {item.existing_policy_source_count ? (
                                      <div>
                                        <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                                          Same policy
                                        </div>
                                        <SourcePreviewList sources={item.existing_policy_sources || []} />
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2 text-[var(--admin-text-soft)]">
                                  {item.unresolved_reason}
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2 text-[var(--admin-text-soft)]">
                                  {item.suggested_next_step}
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2">
                                  {savedDecision ? (
                                    <div className="space-y-1">
                                      <div className="font-medium text-[var(--admin-text)]">
                                        {decisionSummary(savedDecision)}
                                      </div>
                                      <div className="text-[10px] text-[var(--admin-text-muted)]">
                                        {formatAdminDateTime(savedDecision.confirmedAt)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[var(--admin-text-muted)]">No saved decision</span>
                                  )}
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2">
                                  <div className="flex flex-wrap gap-2">
                                    <ActionButton onClick={() => toggleMissingPanel(item.review_key, "search")}>
                                      Search existing sources
                                    </ActionButton>
                                    <ActionButton
                                      onClick={() => prepareMissingSourceAction(item, "attach_existing_source")}
                                      disabled={!draft.selectedSource}
                                      title={
                                        draft.selectedSource
                                          ? `Attach ${draft.selectedSource.source_title}`
                                          : "Select a source from search results first"
                                      }
                                    >
                                      Attach source
                                    </ActionButton>
                                    <ActionButton onClick={() => toggleMissingPanel(item.review_key, "new-source")}>
                                      Add new source
                                    </ActionButton>
                                    <ActionButton onClick={() => toggleMissingPanel(item.review_key, "reviewed")}>
                                      Mark reviewed
                                    </ActionButton>
                                  </div>
                                </td>
                              </tr>

                              {panel ? (
                                <tr key={`${item.review_key}:${panel}`}>
                                  <td colSpan={7} className="border-b border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3">
                                    {panel === "search" ? (
                                      <div className="space-y-3">
                                        <div className="flex flex-wrap gap-3">
                                          <label className="flex min-w-[360px] flex-1 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                            Search query
                                            <input
                                              value={draft.searchQuery || ""}
                                              onChange={(event) =>
                                                updateMissingDraft(
                                                  item.review_key,
                                                  "searchQuery",
                                                  event.target.value
                                                )
                                              }
                                              className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                            />
                                          </label>
                                          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                            Optional note
                                            <input
                                              value={draft.note || ""}
                                              onChange={(event) =>
                                                updateMissingDraft(item.review_key, "note", event.target.value)
                                              }
                                              className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                            />
                                          </label>
                                          <div className="flex items-end gap-2">
                                            <ActionButton
                                              onClick={() => runSourceSearch(item)}
                                              disabled={draft.searchLoading}
                                            >
                                              {draft.searchLoading ? "Searching..." : "Search existing sources"}
                                            </ActionButton>
                                          </div>
                                        </div>
                                        {draft.searchError ? (
                                          <p className="text-[11px] text-[var(--danger)]">{draft.searchError}</p>
                                        ) : null}
                                        <div className="overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
                                          <table className="min-w-full text-[11px]">
                                            <thead className="bg-[var(--admin-surface-muted)] text-left uppercase tracking-wide text-[var(--admin-text-muted)]">
                                              <tr>
                                                <th className="border-b border-[var(--admin-line)] px-2 py-1">Pick</th>
                                                <th className="border-b border-[var(--admin-line)] px-2 py-1">Source</th>
                                                <th className="border-b border-[var(--admin-line)] px-2 py-1">Publisher / Date</th>
                                                <th className="border-b border-[var(--admin-line)] px-2 py-1">Linked Records</th>
                                                <th className="border-b border-[var(--admin-line)] px-2 py-1">Hints</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(draft.searchResults || []).length ? (
                                                draft.searchResults.map((result) => (
                                                  <tr key={result.id} className="odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)]">
                                                    <td className="border-b border-[var(--admin-line)] px-2 py-1">
                                                      <input
                                                        type="radio"
                                                        name={`pick-${item.review_key}`}
                                                        checked={draft.selectedSource?.id === result.id}
                                                        onChange={() =>
                                                          updateMissingDraft(
                                                            item.review_key,
                                                            "selectedSource",
                                                            result
                                                          )
                                                        }
                                                      />
                                                    </td>
                                                    <td className="border-b border-[var(--admin-line)] px-2 py-1">
                                                      <div className="font-medium text-[var(--admin-text)]">
                                                        #{result.id} {result.source_title}
                                                      </div>
                                                      <div className="mt-0.5 max-w-[420px] truncate font-mono text-[10px] text-[var(--admin-text-muted)]" title={result.source_url}>
                                                        {result.source_url}
                                                      </div>
                                                      <div className="mt-0.5 text-[10px] text-[var(--admin-text-muted)]">
                                                        {result.source_type || "unknown"}
                                                      </div>
                                                    </td>
                                                    <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">
                                                      {result.publisher || "publisher unavailable"}
                                                      {result.published_date ? ` • ${result.published_date}` : ""}
                                                    </td>
                                                    <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">
                                                      {result.promise_refs} promise / {result.action_refs} action /{" "}
                                                      {result.outcome_refs} outcome
                                                    </td>
                                                    <td className="border-b border-[var(--admin-line)] px-2 py-1">
                                                      <div className="flex flex-wrap gap-1">
                                                        {result.same_promise_refs ? (
                                                          <CompactBadge tone="success">
                                                            same promise
                                                          </CompactBadge>
                                                        ) : null}
                                                        {result.same_policy_match ? (
                                                          <CompactBadge tone="warning">
                                                            same policy
                                                          </CompactBadge>
                                                        ) : null}
                                                      </div>
                                                    </td>
                                                  </tr>
                                                ))
                                              ) : (
                                                <tr>
                                                  <td colSpan={5} className="px-2 py-3 text-[11px] text-[var(--admin-text-muted)]">
                                                    No candidate sources loaded yet.
                                                  </td>
                                                </tr>
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    ) : null}

                                    {panel === "new-source" ? (
                                      <div className="space-y-3">
                                        <div className="grid gap-3 lg:grid-cols-2">
                                          <label className="flex flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                            Source URL
                                            <input
                                              value={draft.newSourceDraft?.source_url || ""}
                                              onChange={(event) =>
                                                updateMissingNewSourceDraft(
                                                  item.review_key,
                                                  "source_url",
                                                  event.target.value
                                                )
                                              }
                                              className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                            />
                                          </label>
                                          <label className="flex flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                            Title
                                            <input
                                              value={draft.newSourceDraft?.source_title || ""}
                                              onChange={(event) =>
                                                updateMissingNewSourceDraft(
                                                  item.review_key,
                                                  "source_title",
                                                  event.target.value
                                                )
                                              }
                                              className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                            />
                                          </label>
                                          <label className="flex flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                            Source type
                                            <select
                                              value={draft.newSourceDraft?.source_type || ""}
                                              onChange={(event) =>
                                                updateMissingNewSourceDraft(
                                                  item.review_key,
                                                  "source_type",
                                                  event.target.value
                                                )
                                              }
                                              className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                            >
                                              <option value="">Auto (infer from URL)</option>
                                              {SOURCE_TYPES.map((sourceType) => (
                                                <option key={sourceType} value={sourceType}>
                                                  {sourceType}
                                                </option>
                                              ))}
                                            </select>
                                          </label>
                                          <label className="flex flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                            Publisher
                                            <input
                                              value={draft.newSourceDraft?.publisher || ""}
                                              onChange={(event) =>
                                                updateMissingNewSourceDraft(
                                                  item.review_key,
                                                  "publisher",
                                                  event.target.value
                                                )
                                              }
                                              className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                            />
                                          </label>
                                          <label className="flex flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                            Published date
                                            <input
                                              type="date"
                                              value={draft.newSourceDraft?.published_date || ""}
                                              onChange={(event) =>
                                                updateMissingNewSourceDraft(
                                                  item.review_key,
                                                  "published_date",
                                                  event.target.value
                                                )
                                              }
                                              className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                            />
                                          </label>
                                          <label className="flex flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                            Note
                                            <input
                                              value={draft.note || ""}
                                              onChange={(event) =>
                                                updateMissingDraft(item.review_key, "note", event.target.value)
                                              }
                                              className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                            />
                                          </label>
                                          <label className="lg:col-span-2 flex flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                            Optional source notes
                                            <textarea
                                              rows={3}
                                              value={draft.newSourceDraft?.notes || ""}
                                              onChange={(event) =>
                                                updateMissingNewSourceDraft(
                                                  item.review_key,
                                                  "notes",
                                                  event.target.value
                                                )
                                              }
                                              className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                            />
                                          </label>
                                        </div>

                                        {(draft.duplicateWarning || []).length ? (
                                          <div className="rounded border border-[var(--admin-warning-line)] bg-[var(--admin-warning-surface)] p-3">
                                            <p className="font-medium text-[var(--warning)]">
                                              Likely duplicate sources already exist
                                            </p>
                                            <div className="mt-2 space-y-1 text-[11px] text-[var(--warning)]">
                                              {draft.duplicateWarning.map((source) => (
                                                <div key={source.id}>
                                                  #{source.id} {source.source_title}{" "}
                                                  <span className="font-mono">{source.source_url}</span>
                                                </div>
                                              ))}
                                            </div>
                                            <label className="mt-3 flex items-center gap-2 text-[11px] text-[var(--warning)]">
                                              <input
                                                type="checkbox"
                                                checked={Boolean(draft.overrideDuplicateWarning)}
                                                onChange={(event) =>
                                                  updateMissingDraft(
                                                    item.review_key,
                                                    "overrideDuplicateWarning",
                                                    event.target.checked
                                                  )
                                                }
                                              />
                                              <span>
                                                I reviewed the duplicate warning and still want to
                                                create a new source.
                                              </span>
                                            </label>
                                          </div>
                                        ) : null}
                                        <div className="flex justify-end">
                                          <ActionButton
                                            tone="primary"
                                            onClick={() =>
                                              prepareMissingSourceAction(
                                                item,
                                                "create_and_attach_source"
                                              )
                                            }
                                          >
                                            Add new source
                                          </ActionButton>
                                        </div>
                                      </div>
                                    ) : null}

                                    {panel === "reviewed" ? (
                                      <div className="space-y-3">
                                        <label className="flex flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                          Review note
                                          <textarea
                                            rows={3}
                                            value={draft.note || ""}
                                            onChange={(event) =>
                                              updateMissingDraft(item.review_key, "note", event.target.value)
                                            }
                                            className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                          />
                                        </label>
                                        <div className="flex justify-end">
                                          <ActionButton
                                            tone="primary"
                                            onClick={() =>
                                              prepareMissingSourceAction(
                                                item,
                                                "mark_missing_source_reviewed"
                                              )
                                            }
                                          >
                                            Mark reviewed
                                          </ActionButton>
                                        </div>
                                      </div>
                                    ) : null}

                                    {confirmationState?.key === item.review_key &&
                                    confirmationState?.entityType === "missing-source" ? (
                                      <div className="mt-4 rounded border border-[var(--admin-info-line)] bg-[var(--admin-info-surface)] p-3">
                                        <p className="font-medium text-[var(--info)]">
                                          {confirmationState.title}
                                        </p>
                                        <p className="mt-1 text-[11px] text-[var(--admin-link)]">
                                          {confirmationState.description}
                                        </p>
                                        <label className="mt-3 flex items-center gap-2 text-[11px] text-[var(--info)]">
                                          <input
                                            type="checkbox"
                                            checked={confirmationChecked}
                                            onChange={(event) =>
                                              setConfirmationChecked(event.target.checked)
                                            }
                                          />
                                          <span>
                                            I understand this action is explicit, auditable, and
                                            will not run without my confirmation.
                                          </span>
                                        </label>
                                        <div className="mt-3 flex justify-end gap-2">
                                          <ActionButton
                                            onClick={() => {
                                              setConfirmationState(null);
                                              setConfirmationChecked(false);
                                            }}
                                          >
                                            Cancel
                                          </ActionButton>
                                          <ActionButton
                                            tone="primary"
                                            disabled={!confirmationChecked || isPending}
                                            onClick={runConfirmedAction}
                                          >
                                            {isPending ? "Working..." : "Confirm"}
                                          </ActionButton>
                                        </div>
                                      </div>
                                    ) : null}
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {activeTab === "duplicates" ? (
        <SectionCard
          title="Duplicate Source Review"
          description="Review unsafe duplicate clusters, compare member rows, keep them separate, or merge a selected compatible subset after confirmation."
        >
          {!visibleDuplicateGroups.length ? (
            <p className="text-[12px] text-[var(--admin-text-soft)]">
              No duplicate source clusters require manual review.
            </p>
          ) : (
            <div className="space-y-4">
              {visibleDuplicateGroups.map((group) => (
                <section key={group.id} className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)]">
                  <div className="border-b border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                          duplicate review reason
                        </p>
                        <h4 className="text-sm font-semibold text-[var(--admin-text)]">
                          {group.reason}
                        </h4>
                      </div>
                      <CompactBadge>{group.clusters.length} cluster(s)</CompactBadge>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[1560px] w-full text-[11px]">
                      <thead className="bg-[var(--admin-surface-muted)] text-left uppercase tracking-wide text-[var(--admin-text-muted)]">
                        <tr>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Cluster</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Titles / Types</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Publisher / Date</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Policy Ownership</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Rejected Reasons</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Saved Decision</th>
                          <th className="border-b border-[var(--admin-line)] px-2 py-1">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.clusters.map((cluster) => {
                          const draft = duplicateDrafts[cluster.cluster_key] || {
                            note: "",
                            selectedSourceIds: [],
                            canonicalSourceId: null,
                          };
                          const panel = activeDuplicatePanel[cluster.cluster_key] || "";
                          const savedDecision =
                            duplicateDecisions[cluster.cluster_key] || cluster.saved_decision;

                          return (
                            <Fragment key={cluster.cluster_key}>
                              <tr key={cluster.cluster_key} className="align-top odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)] hover:bg-[var(--admin-surface-soft)]">
                                <td className="border-b border-[var(--admin-line)] px-2 py-2">
                                  <div className="font-mono text-[10px] text-[var(--admin-text)]">
                                    {cluster.cluster_key}
                                  </div>
                                  <div className="mt-1 max-w-[320px] truncate text-[var(--admin-text-soft)]" title={cluster.source_url}>
                                    {cluster.source_url}
                                  </div>
                                  <div className="mt-1 text-[10px] text-[var(--admin-text-muted)]">
                                    source ids: {cluster.rows.map((row) => row.id).join(", ")}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Link
                                      href={cluster.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[var(--admin-link)] underline"
                                    >
                                      Open sources
                                    </Link>
                                  </div>
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2 text-[var(--admin-text-soft)]">
                                  <div>{cluster.distinct_titles.join(" • ") || "—"}</div>
                                  <div className="mt-1 text-[10px] text-[var(--admin-text-muted)]">
                                    {cluster.distinct_source_types.join(" • ") || "—"}
                                  </div>
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2 text-[var(--admin-text-soft)]">
                                  <div>{cluster.distinct_publishers.join(" • ") || "—"}</div>
                                  <div className="mt-1 text-[10px] text-[var(--admin-text-muted)]">
                                    {cluster.distinct_published_dates.join(" • ") || "—"}
                                  </div>
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2 text-[var(--admin-text-soft)]">
                                  {cluster.distinct_policy_ids.length
                                    ? cluster.distinct_policy_ids.join(", ")
                                    : "none"}
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {(cluster.auto_merge_rejected_reasons || []).map((reason) => (
                                      <CompactBadge key={reason} tone="warning">
                                        {reason}
                                      </CompactBadge>
                                    ))}
                                  </div>
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2">
                                  {savedDecision ? (
                                    <div className="space-y-1">
                                      <div className="font-medium text-[var(--admin-text)]">
                                        {decisionSummary(savedDecision)}
                                      </div>
                                      <div className="text-[10px] text-[var(--admin-text-muted)]">
                                        {formatAdminDateTime(savedDecision.confirmedAt)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[var(--admin-text-muted)]">No saved decision</span>
                                  )}
                                </td>
                                <td className="border-b border-[var(--admin-line)] px-2 py-2">
                                  <div className="flex flex-wrap gap-2">
                                    <ActionButton onClick={() => toggleDuplicatePanel(cluster.cluster_key, "compare")}>
                                      Compare records
                                    </ActionButton>
                                    <ActionButton onClick={() => toggleDuplicatePanel(cluster.cluster_key, "merge")}>
                                      Merge selected
                                    </ActionButton>
                                    <ActionButton
                                      onClick={() =>
                                        toggleDuplicatePanel(cluster.cluster_key, "keep-separate")
                                      }
                                    >
                                      Mark keep separate
                                    </ActionButton>
                                    <ActionButton
                                      onClick={() =>
                                        toggleDuplicatePanel(cluster.cluster_key, "reviewed")
                                      }
                                    >
                                      Mark reviewed
                                    </ActionButton>
                                  </div>
                                </td>
                              </tr>

                              {panel ? (
                                <tr key={`${cluster.cluster_key}:${panel}`}>
                                  <td colSpan={7} className="border-b border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3">
                                    {panel === "compare" || panel === "merge" ? (
                                      <div className="space-y-3">
                                        <div className="overflow-x-auto rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]">
                                          <table className="min-w-full text-[11px]">
                                            <thead className="bg-[var(--admin-surface-muted)] text-left uppercase tracking-wide text-[var(--admin-text-muted)]">
                                              <tr>
                                                {panel === "merge" ? (
                                                  <>
                                                    <th className="border-b border-[var(--admin-line)] px-2 py-1">Select</th>
                                                    <th className="border-b border-[var(--admin-line)] px-2 py-1">Keep</th>
                                                  </>
                                                ) : null}
                                                <th className="border-b border-[var(--admin-line)] px-2 py-1">Source</th>
                                                <th className="border-b border-[var(--admin-line)] px-2 py-1">Publisher / Date</th>
                                                <th className="border-b border-[var(--admin-line)] px-2 py-1">Policy ID</th>
                                                <th className="border-b border-[var(--admin-line)] px-2 py-1">References</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {cluster.rows.map((row) => (
                                                <tr key={row.id} className="odd:bg-[var(--admin-surface)] even:bg-[var(--admin-surface-muted)]">
                                                  {panel === "merge" ? (
                                                    <>
                                                      <td className="border-b border-[var(--admin-line)] px-2 py-1">
                                                        <input
                                                          type="checkbox"
                                                          checked={draft.selectedSourceIds.includes(row.id)}
                                                          onChange={() =>
                                                            toggleClusterSelection(cluster.cluster_key, row.id)
                                                          }
                                                        />
                                                      </td>
                                                      <td className="border-b border-[var(--admin-line)] px-2 py-1">
                                                        <input
                                                          type="radio"
                                                          name={`canonical-${cluster.cluster_key}`}
                                                          checked={draft.canonicalSourceId === row.id}
                                                          disabled={!draft.selectedSourceIds.includes(row.id)}
                                                          onChange={() =>
                                                            updateDuplicateDraft(
                                                              cluster.cluster_key,
                                                              "canonicalSourceId",
                                                              row.id
                                                            )
                                                          }
                                                        />
                                                      </td>
                                                    </>
                                                  ) : null}
                                                  <td className="border-b border-[var(--admin-line)] px-2 py-1">
                                                    <div className="font-medium text-[var(--admin-text)]">
                                                      #{row.id} {row.source_title}
                                                    </div>
                                                    <div className="mt-0.5 font-mono text-[10px] text-[var(--admin-text-muted)]">
                                                      {row.source_url}
                                                    </div>
                                                    <div className="mt-0.5 text-[10px] text-[var(--admin-text-muted)]">
                                                      {row.source_type || "unknown"}
                                                    </div>
                                                  </td>
                                                  <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">
                                                    {row.publisher || "publisher unavailable"}
                                                    {row.published_date ? ` • ${row.published_date}` : ""}
                                                  </td>
                                                  <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">
                                                    {row.policy_id == null ? "—" : row.policy_id}
                                                  </td>
                                                  <td className="border-b border-[var(--admin-line)] px-2 py-1 text-[var(--admin-text-soft)]">
                                                    {row.promise_refs} promise / {row.action_refs} action /{" "}
                                                    {row.outcome_refs} outcome
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>

                                        {panel === "merge" ? (
                                          <div className="space-y-3">
                                            <label className="flex flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                              Merge note
                                              <textarea
                                                rows={3}
                                                value={draft.note || ""}
                                                onChange={(event) =>
                                                  updateDuplicateDraft(
                                                    cluster.cluster_key,
                                                    "note",
                                                    event.target.value
                                                  )
                                                }
                                                className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                              />
                                            </label>
                                            <div className="flex justify-end">
                                              <ActionButton
                                                tone="danger"
                                                onClick={() =>
                                                  prepareDuplicateAction(
                                                    cluster,
                                                    "merge_duplicate_sources"
                                                  )
                                                }
                                              >
                                                Merge selected
                                              </ActionButton>
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    {panel === "keep-separate" || panel === "reviewed" ? (
                                      <div className="space-y-3">
                                        <label className="flex flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                          Review note
                                          <textarea
                                            rows={3}
                                            value={draft.note || ""}
                                            onChange={(event) =>
                                              updateDuplicateDraft(
                                                cluster.cluster_key,
                                                "note",
                                                event.target.value
                                              )
                                            }
                                            className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                          />
                                        </label>
                                        <div className="flex justify-end">
                                          <ActionButton
                                            tone="primary"
                                            onClick={() =>
                                              prepareDuplicateAction(
                                                cluster,
                                                panel === "keep-separate"
                                                  ? "keep_duplicate_sources_separate"
                                                  : "mark_duplicate_cluster_reviewed"
                                              )
                                            }
                                          >
                                            {panel === "keep-separate"
                                              ? "Mark keep separate"
                                              : "Mark reviewed"}
                                          </ActionButton>
                                        </div>
                                      </div>
                                    ) : null}

                                    {confirmationState?.key === cluster.cluster_key &&
                                    confirmationState?.entityType === "duplicate-cluster" ? (
                                      <div className="mt-4 rounded border border-[var(--admin-info-line)] bg-[var(--admin-info-surface)] p-3">
                                        <p className="font-medium text-[var(--info)]">
                                          {confirmationState.title}
                                        </p>
                                        <p className="mt-1 text-[11px] text-[var(--admin-link)]">
                                          {confirmationState.description}
                                        </p>
                                        <label className="mt-3 flex items-center gap-2 text-[11px] text-[var(--info)]">
                                          <input
                                            type="checkbox"
                                            checked={confirmationChecked}
                                            onChange={(event) =>
                                              setConfirmationChecked(event.target.checked)
                                            }
                                          />
                                          <span>
                                            I understand this duplicate-source decision is explicit,
                                            audited, and may mutate canonical source rows if I
                                            confirm a merge.
                                          </span>
                                        </label>
                                        <div className="mt-3 flex justify-end gap-2">
                                          <ActionButton
                                            onClick={() => {
                                              setConfirmationState(null);
                                              setConfirmationChecked(false);
                                            }}
                                          >
                                            Cancel
                                          </ActionButton>
                                          <ActionButton
                                            tone="primary"
                                            disabled={!confirmationChecked || isPending}
                                            onClick={runConfirmedAction}
                                          >
                                            {isPending ? "Working..." : "Confirm"}
                                          </ActionButton>
                                        </div>
                                      </div>
                                    ) : null}
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
