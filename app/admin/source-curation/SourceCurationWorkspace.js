"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { formatAdminDateTime } from "@/app/admin/components/adminDateTime";
import { readAdminJsonResponse } from "@/app/admin/components/readAdminJsonResponse";
import { SOURCE_TYPES } from "@/lib/admin/promiseValidation";

const SOURCE_CURATION_ENDPOINTS = [
  "/api/admin/source-curation",
  "/admin/source-curation/api",
];
const GROUP_EXPANSION_STORAGE_KEY = "equitystack.source-curation.group-expansion";

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
      {detail ? <p className="mt-1 break-all text-[11px] text-[var(--admin-text-soft)]">{detail}</p> : null}
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

function InfoBlock({ label, children }) {
  return (
    <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)] p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
        {label}
      </div>
      <div className="mt-2 min-w-0 text-[11px] text-[var(--admin-text-soft)]">{children}</div>
    </div>
  );
}

function SourcePreviewList({ sources = [] }) {
  if (!sources.length) {
    return <span className="text-[var(--admin-text-muted)]">No related source context recorded.</span>;
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => (
        <div key={source.id} className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-2">
          <div className="font-medium text-[var(--admin-text)]">
            #{source.id} {source.source_title}
          </div>
          <div className="mt-1 break-all font-mono text-[10px] text-[var(--admin-text-muted)]">
            {source.source_url}
          </div>
          <div className="mt-1 text-[10px] text-[var(--admin-text-soft)]">
            {[source.publisher, source.published_date, source.source_type].filter(Boolean).join(" • ") || "Metadata unavailable"}
          </div>
        </div>
      ))}
    </div>
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
  if (
    decision.actionType === "create_and_attach_source" ||
    decision.actionType === "add_new_source"
  ) {
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
  if (decision.actionType === "mark_duplicate_cluster_reviewed") {
    return "Marked reviewed";
  }
  return "Saved decision";
}

function decisionStatus(decision, entityType) {
  if (!decision) {
    return {
      label: "pending",
      tone: "warning",
    };
  }

  if (entityType === "missing") {
    if (
      decision.actionType === "attach_existing_source" ||
      decision.actionType === "create_and_attach_source" ||
      decision.actionType === "add_new_source"
    ) {
      return {
        label: "attached",
        tone: "success",
      };
    }

    if (
      decision.actionType === "mark_missing_source_reviewed" ||
      decision.actionType === "mark_reviewed"
    ) {
      return {
        label: "reviewed",
        tone: "neutral",
      };
    }

    return {
      label: "saved decision",
      tone: "neutral",
    };
  }

  if (decision.actionType === "merge_duplicate_sources") {
    return {
      label: "merged",
      tone: "success",
    };
  }
  if (decision.actionType === "keep_duplicate_sources_separate") {
    return {
      label: "keep separate",
      tone: "neutral",
    };
  }
  if (decision.actionType === "mark_duplicate_cluster_reviewed") {
    return {
      label: "reviewed",
      tone: "neutral",
    };
  }

  return {
    label: "saved decision",
    tone: "neutral",
  };
}

function orderGroupsByCompletion(groups = []) {
  const pending = groups.filter((group) => !group.isComplete);
  const completed = groups.filter((group) => group.isComplete);
  return [...pending, ...completed];
}

function decorateMissingGroups(workspace, savedDecisions) {
  const groups = (workspace.missingSources.groups || []).map((group, index) => {
    const groupId = group.id || `missing-group-${index}`;
    const items = (group.items || []).map((item) => {
      const savedDecision = savedDecisions[item.review_key] || item.saved_decision || null;
      return {
        ...item,
        group_id: groupId,
        saved_decision: savedDecision,
        ui_status: decisionStatus(savedDecision, "missing"),
      };
    });
    const completedCount = items.filter((item) => Boolean(item.saved_decision)).length;
    const pendingCount = items.length - completedCount;
    const isComplete = items.length > 0 && pendingCount === 0;

    return {
      ...group,
      id: groupId,
      items,
      completedCount,
      pendingCount,
      isComplete,
      group_status: isComplete ? "complete" : completedCount > 0 ? "in progress" : "pending",
      group_status_tone: isComplete ? "success" : "warning",
    };
  });

  return orderGroupsByCompletion(groups);
}

function decorateDuplicateGroups(workspace, savedDecisions) {
  const groups = (workspace.duplicates.groups || []).map((group, index) => {
    const groupId = group.id || `duplicate-group-${index}`;
    const clusters = (group.clusters || []).map((cluster) => {
      const savedDecision = savedDecisions[cluster.cluster_key] || cluster.saved_decision || null;
      return {
        ...cluster,
        group_id: groupId,
        saved_decision: savedDecision,
        ui_status: decisionStatus(savedDecision, "duplicate"),
      };
    });
    const completedCount = clusters.filter((cluster) => Boolean(cluster.saved_decision)).length;
    const pendingCount = clusters.length - completedCount;
    const isComplete = clusters.length > 0 && pendingCount === 0;

    return {
      ...group,
      id: groupId,
      clusters,
      completedCount,
      pendingCount,
      isComplete,
      group_status: isComplete ? "complete" : completedCount > 0 ? "in progress" : "pending",
      group_status_tone: isComplete ? "success" : "warning",
    };
  });

  return orderGroupsByCompletion(groups);
}

function readStoredGroupExpansion() {
  if (typeof window === "undefined") {
    return {
      missing: {},
      duplicates: {},
    };
  }

  try {
    const raw = window.sessionStorage.getItem(GROUP_EXPANSION_STORAGE_KEY);
    if (!raw) {
      return {
        missing: {},
        duplicates: {},
      };
    }
    const parsed = JSON.parse(raw);
    return {
      missing: parsed?.missing && typeof parsed.missing === "object" ? parsed.missing : {},
      duplicates:
        parsed?.duplicates && typeof parsed.duplicates === "object" ? parsed.duplicates : {},
    };
  } catch {
    return {
      missing: {},
      duplicates: {},
    };
  }
}

function mergeGroupExpansionState(currentState = {}, groups = []) {
  const firstIncompleteGroupId = groups.find((group) => !group.isComplete)?.id || groups[0]?.id || null;
  let changed = false;
  const nextState = {};

  for (const group of groups) {
    if (Object.prototype.hasOwnProperty.call(currentState, group.id)) {
      nextState[group.id] = currentState[group.id];
      continue;
    }

    nextState[group.id] = group.id === firstIncompleteGroupId;
    changed = true;
  }

  if (Object.keys(currentState).length !== Object.keys(nextState).length) {
    changed = true;
  }

  if (!changed) {
    return currentState;
  }
  return nextState;
}

function formatCountLabel(completedCount, pendingCount, noun) {
  const total = completedCount + pendingCount;
  return `${total} ${noun}`;
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
  const [groupExpansion, setGroupExpansion] = useState({
    missing: {},
    duplicates: {},
  });
  const [groupExpansionReady, setGroupExpansionReady] = useState(false);
  const [confirmationState, setConfirmationState] = useState(null);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const missingGroups = useMemo(
    () => decorateMissingGroups(workspace, missingDecisions),
    [workspace, missingDecisions]
  );
  const duplicateGroups = useMemo(
    () => decorateDuplicateGroups(workspace, duplicateDecisions),
    [workspace, duplicateDecisions]
  );

  useEffect(() => {
    setGroupExpansion(readStoredGroupExpansion());
    setGroupExpansionReady(true);
  }, []);

  useEffect(() => {
    if (!groupExpansionReady) {
      return;
    }

    setGroupExpansion((current) => {
      const nextMissing = mergeGroupExpansionState(current.missing, missingGroups);
      const nextDuplicates = mergeGroupExpansionState(current.duplicates, duplicateGroups);

      if (nextMissing === current.missing && nextDuplicates === current.duplicates) {
        return current;
      }

      return {
        missing: nextMissing,
        duplicates: nextDuplicates,
      };
    });
  }, [groupExpansionReady, missingGroups, duplicateGroups]);

  useEffect(() => {
    if (!groupExpansionReady || typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      GROUP_EXPANSION_STORAGE_KEY,
      JSON.stringify(groupExpansion)
    );
  }, [groupExpansion, groupExpansionReady]);

  const missingGroupIdByReviewKey = useMemo(() => {
    const map = new Map();
    for (const group of missingGroups) {
      for (const item of group.items) {
        map.set(item.review_key, group.id);
      }
    }
    return map;
  }, [missingGroups]);

  const duplicateGroupIdByClusterKey = useMemo(() => {
    const map = new Map();
    for (const group of duplicateGroups) {
      for (const cluster of group.clusters) {
        map.set(cluster.cluster_key, group.id);
      }
    }
    return map;
  }, [duplicateGroups]);

  const missingItemCount = missingGroups.reduce(
    (count, group) => count + group.items.length,
    0
  );
  const missingReviewedCount = missingGroups.reduce(
    (count, group) => count + group.completedCount,
    0
  );
  const duplicateClusterCount = duplicateGroups.reduce(
    (count, group) => count + group.clusters.length,
    0
  );
  const duplicateReviewedCount = duplicateGroups.reduce(
    (count, group) => count + group.completedCount,
    0
  );

  function clearMessages() {
    setMessage("");
    setErrorMessage("");
  }

  function openGroup(tab, groupId) {
    if (!groupId) {
      return;
    }

    setGroupExpansion((current) => ({
      ...current,
      [tab]: {
        ...(current[tab] || {}),
        [groupId]: true,
      },
    }));
  }

  function toggleGroup(tab, groupId) {
    setGroupExpansion((current) => ({
      ...current,
      [tab]: {
        ...(current[tab] || {}),
        [groupId]: !current[tab]?.[groupId],
      },
    }));
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

  function toggleMissingPanel(item, panel) {
    clearMessages();
    setConfirmationState(null);
    setConfirmationChecked(false);
    openGroup("missing", item.group_id);
    setActiveMissingPanel((current) => ({
      ...current,
      [item.review_key]: current[item.review_key] === panel ? "" : panel,
    }));
  }

  function toggleDuplicatePanel(cluster, panel) {
    clearMessages();
    setConfirmationState(null);
    setConfirmationChecked(false);
    openGroup("duplicates", cluster.group_id);
    setActiveDuplicatePanel((current) => ({
      ...current,
      [cluster.cluster_key]: current[cluster.cluster_key] === panel ? "" : panel,
    }));
  }

  async function runSourceSearch(item) {
    const draft = missingDrafts[item.review_key] || {};
    clearMessages();
    openGroup("missing", item.group_id);
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
    openGroup("missing", item.group_id);

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
    openGroup("duplicates", cluster.group_id);

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
      openGroup("missing", missingGroupIdByReviewKey.get(result.decision.reviewKey));
      return;
    }

    setDuplicateDecisions((current) => ({
      ...current,
      [result.decision.clusterKey]: result.decision,
    }));
    openGroup("duplicates", duplicateGroupIdByClusterKey.get(result.decision.clusterKey));
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
            updateMissingDraft(
              confirmationState.key,
              "duplicateWarning",
              payload.errorDetails.possibleDuplicates
            );
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
          {!missingGroups.length ? (
            <p className="text-[12px] text-[var(--admin-text-soft)]">
              No unresolved missing-source records are pending.
            </p>
          ) : (
            <div className="space-y-4">
              {missingGroups.map((group) => {
                const isExpanded = Boolean(groupExpansion.missing?.[group.id]);

                return (
                  <section key={group.id} className="overflow-hidden rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)]">
                    <button
                      type="button"
                      onClick={() => toggleGroup("missing", group.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                          {group.president_name}
                        </p>
                        <h4 className="mt-1 text-sm font-semibold text-[var(--admin-text)]">
                          {group.topic}
                        </h4>
                        <p className="mt-1 text-[10px] text-[var(--admin-text-muted)]">
                          Import origin: {group.import_origin}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <CompactBadge>{formatCountLabel(group.completedCount, group.pendingCount, "row(s)")}</CompactBadge>
                        <CompactBadge tone="success">{group.completedCount} completed</CompactBadge>
                        <CompactBadge tone="warning">{group.pendingCount} pending</CompactBadge>
                        <CompactBadge tone={group.group_status_tone}>{group.group_status}</CompactBadge>
                        <CompactBadge>{isExpanded ? "collapse" : "expand"}</CompactBadge>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="space-y-3 p-3">
                        {group.isComplete ? (
                          <div className="rounded border border-[var(--admin-success-line)] bg-[var(--admin-success-surface)] p-3 text-[11px] text-[var(--success)]">
                            Every row in this group has a saved decision. The group stays visible so you can revisit or revise any record before leaving the session.
                          </div>
                        ) : null}

                        {group.items.map((item) => {
                          const draft = missingDrafts[item.review_key] || {};
                          const panel = activeMissingPanel[item.review_key] || "";

                          return (
                            <article
                              key={item.review_key}
                              className="overflow-hidden rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-line)] px-3 py-3">
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <CompactBadge tone={item.ui_status.tone}>{item.ui_status.label}</CompactBadge>
                                    <CompactBadge tone="warning">{item.record_type}</CompactBadge>
                                    <CompactBadge tone="danger">missing source</CompactBadge>
                                    <span className="font-mono text-[10px] text-[var(--admin-text-muted)]">
                                      #{item.record_id}
                                    </span>
                                  </div>
                                  <div className="text-sm font-semibold text-[var(--admin-text)]">
                                    {item.record_text}
                                  </div>
                                  {item.record_detail ? (
                                    <p className="max-w-4xl text-[11px] text-[var(--admin-text-soft)]">
                                      {item.record_detail}
                                    </p>
                                  ) : null}
                                  {item.related_policy_title ? (
                                    <p className="text-[10px] text-[var(--admin-text-muted)]">
                                      Related policy: {item.related_policy_title}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <ActionButton onClick={() => toggleMissingPanel(item, "search")}>
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
                                  <ActionButton onClick={() => toggleMissingPanel(item, "new-source")}>
                                    Add new source
                                  </ActionButton>
                                  <ActionButton onClick={() => toggleMissingPanel(item, "reviewed")}>
                                    Mark reviewed
                                  </ActionButton>
                                </div>
                              </div>

                              <div className="grid gap-3 px-3 py-3 xl:grid-cols-2">
                                <div className="space-y-3">
                                  <InfoBlock label="Promise">
                                    <div className="font-medium text-[var(--admin-text)]">{item.promise_title}</div>
                                    <div className="mt-1 break-all font-mono text-[10px] text-[var(--admin-text-muted)]">
                                      {item.promise_slug}
                                    </div>
                                    <div className="mt-2">
                                      <Link
                                        href={`/promises/${item.promise_slug}`}
                                        className="text-[var(--admin-link)] underline"
                                      >
                                        Open related promise
                                      </Link>
                                    </div>
                                  </InfoBlock>

                                  <InfoBlock label="Reason">{item.unresolved_reason}</InfoBlock>
                                  <InfoBlock label="Suggested Next Step">
                                    {item.suggested_next_step}
                                  </InfoBlock>
                                </div>

                                <div className="space-y-3">
                                  <InfoBlock label="Existing Source Context">
                                    <div className="space-y-3">
                                      <div>
                                        <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                                          Same promise
                                        </div>
                                        <SourcePreviewList sources={item.existing_promise_sources || []} />
                                        <div className="mt-2 text-[10px] text-[var(--admin-text-muted)]">
                                          {item.existing_promise_source_count || 0} total same-promise source(s)
                                        </div>
                                      </div>

                                      {item.existing_policy_source_count ? (
                                        <div>
                                          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)]">
                                            Same policy
                                          </div>
                                          <SourcePreviewList sources={item.existing_policy_sources || []} />
                                        </div>
                                      ) : null}
                                    </div>
                                  </InfoBlock>

                                  <InfoBlock label="Saved Decision">
                                    {item.saved_decision ? (
                                      <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <CompactBadge tone={item.ui_status.tone}>
                                            {item.ui_status.label}
                                          </CompactBadge>
                                          <span className="font-medium text-[var(--admin-text)]">
                                            {decisionSummary(item.saved_decision)}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-[var(--admin-text-muted)]">
                                          {formatAdminDateTime(item.saved_decision.confirmedAt)}
                                        </div>
                                        {item.saved_decision.note ? (
                                          <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-2 text-[11px] text-[var(--admin-text-soft)]">
                                            {item.saved_decision.note}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <span className="text-[var(--admin-text-muted)]">No saved decision</span>
                                    )}
                                  </InfoBlock>
                                </div>
                              </div>

                              {panel ? (
                                <div className="border-t border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3">
                                  {panel === "search" ? (
                                    <div className="space-y-3">
                                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]">
                                        <label className="flex min-w-0 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
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
                                        <label className="flex min-w-0 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
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

                                      {(draft.searchResults || []).length ? (
                                        <div className="space-y-2">
                                          {draft.searchResults.map((result) => {
                                            const isSelected = draft.selectedSource?.id === result.id;

                                            return (
                                              <label
                                                key={result.id}
                                                className={`block cursor-pointer rounded border p-3 ${
                                                  isSelected
                                                    ? "border-[var(--admin-link)] bg-[var(--admin-info-surface)]"
                                                    : "border-[var(--admin-line)] bg-[var(--admin-surface)]"
                                                }`}
                                              >
                                                <div className="flex items-start gap-3">
                                                  <input
                                                    type="radio"
                                                    name={`pick-${item.review_key}`}
                                                    checked={isSelected}
                                                    onChange={() =>
                                                      updateMissingDraft(
                                                        item.review_key,
                                                        "selectedSource",
                                                        result
                                                      )
                                                    }
                                                    className="mt-1"
                                                  />
                                                  <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-[var(--admin-text)]">
                                                      #{result.id} {result.source_title}
                                                    </div>
                                                    <div className="mt-1 break-all font-mono text-[10px] text-[var(--admin-text-muted)]">
                                                      {result.source_url}
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--admin-text-soft)]">
                                                      <CompactBadge>{result.source_type || "unknown"}</CompactBadge>
                                                      <span>
                                                        {result.publisher || "publisher unavailable"}
                                                        {result.published_date ? ` • ${result.published_date}` : ""}
                                                      </span>
                                                      <span>
                                                        {result.promise_refs} promise / {result.action_refs} action /{" "}
                                                        {result.outcome_refs} outcome
                                                      </span>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                      {result.same_promise_refs ? (
                                                        <CompactBadge tone="success">same promise</CompactBadge>
                                                      ) : null}
                                                      {result.same_policy_match ? (
                                                        <CompactBadge tone="warning">same policy</CompactBadge>
                                                      ) : null}
                                                    </div>
                                                  </div>
                                                </div>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] px-3 py-4 text-[11px] text-[var(--admin-text-muted)]">
                                          No candidate sources loaded yet.
                                        </div>
                                      )}

                                      <div className="flex justify-end">
                                        <ActionButton
                                          tone="primary"
                                          onClick={() =>
                                            prepareMissingSourceAction(item, "attach_existing_source")
                                          }
                                          disabled={!draft.selectedSource}
                                        >
                                          Attach source
                                        </ActionButton>
                                      </div>
                                    </div>
                                  ) : null}

                                  {panel === "new-source" ? (
                                    <div className="space-y-3">
                                      <div className="grid gap-3 lg:grid-cols-2">
                                        <label className="flex min-w-0 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
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
                                        <label className="flex min-w-0 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
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
                                        <label className="flex min-w-0 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
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
                                        <label className="flex min-w-0 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
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
                                        <label className="flex min-w-0 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
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
                                        <label className="flex min-w-0 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
                                          Note
                                          <input
                                            value={draft.note || ""}
                                            onChange={(event) =>
                                              updateMissingDraft(item.review_key, "note", event.target.value)
                                            }
                                            className="rounded border border-[var(--admin-line-strong)] bg-[var(--admin-surface)] px-2 py-1.5 text-[12px] text-[var(--admin-text)]"
                                          />
                                        </label>
                                        <label className="lg:col-span-2 flex min-w-0 flex-col gap-1 text-[11px] text-[var(--admin-text-soft)]">
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
                                                <span className="break-all font-mono">{source.source_url}</span>
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
                                            prepareMissingSourceAction(item, "create_and_attach_source")
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
                                            prepareMissingSourceAction(item, "mark_missing_source_reviewed")
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
                                          I understand this action is explicit, auditable, and will
                                          not run without my confirmation.
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
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </SectionCard>
      ) : null}

      {activeTab === "duplicates" ? (
        <SectionCard
          title="Duplicate Source Review"
          description="Review unsafe duplicate clusters, compare member rows, keep them separate, or merge a selected compatible subset after confirmation."
        >
          {!duplicateGroups.length ? (
            <p className="text-[12px] text-[var(--admin-text-soft)]">
              No duplicate source clusters require manual review.
            </p>
          ) : (
            <div className="space-y-4">
              {duplicateGroups.map((group) => {
                const isExpanded = Boolean(groupExpansion.duplicates?.[group.id]);

                return (
                  <section key={group.id} className="overflow-hidden rounded border border-[var(--admin-line)] bg-[var(--admin-surface-muted)]">
                    <button
                      type="button"
                      onClick={() => toggleGroup("duplicates", group.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--admin-text-muted)]">
                          duplicate review reason
                        </p>
                        <h4 className="mt-1 text-sm font-semibold text-[var(--admin-text)]">
                          {group.reason}
                        </h4>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <CompactBadge>{formatCountLabel(group.completedCount, group.pendingCount, "cluster(s)")}</CompactBadge>
                        <CompactBadge tone="success">{group.completedCount} completed</CompactBadge>
                        <CompactBadge tone="warning">{group.pendingCount} pending</CompactBadge>
                        <CompactBadge tone={group.group_status_tone}>{group.group_status}</CompactBadge>
                        <CompactBadge>{isExpanded ? "collapse" : "expand"}</CompactBadge>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="space-y-3 p-3">
                        {group.isComplete ? (
                          <div className="rounded border border-[var(--admin-success-line)] bg-[var(--admin-success-surface)] p-3 text-[11px] text-[var(--success)]">
                            Every duplicate cluster in this group has a saved decision. The group stays visible so you can revisit or revise any cluster before leaving the session.
                          </div>
                        ) : null}

                        {group.clusters.map((cluster) => {
                          const draft = duplicateDrafts[cluster.cluster_key] || {
                            note: "",
                            selectedSourceIds: [],
                            canonicalSourceId: null,
                          };
                          const panel = activeDuplicatePanel[cluster.cluster_key] || "";

                          return (
                            <article
                              key={cluster.cluster_key}
                              className="overflow-hidden rounded border border-[var(--admin-line)] bg-[var(--admin-surface)]"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-line)] px-3 py-3">
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <CompactBadge tone={cluster.ui_status.tone}>{cluster.ui_status.label}</CompactBadge>
                                    <CompactBadge tone="warning">duplicate cluster</CompactBadge>
                                  </div>
                                  <div className="break-all font-mono text-[10px] text-[var(--admin-text)]">
                                    {cluster.cluster_key}
                                  </div>
                                  <div className="break-all text-[11px] text-[var(--admin-text-soft)]">
                                    {cluster.source_url}
                                  </div>
                                  <div className="text-[10px] text-[var(--admin-text-muted)]">
                                    source ids: {cluster.rows.map((row) => row.id).join(", ")}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <ActionButton onClick={() => toggleDuplicatePanel(cluster, "compare")}>
                                    Compare records
                                  </ActionButton>
                                  <ActionButton onClick={() => toggleDuplicatePanel(cluster, "merge")}>
                                    Merge selected
                                  </ActionButton>
                                  <ActionButton onClick={() => toggleDuplicatePanel(cluster, "keep-separate")}>
                                    Mark keep separate
                                  </ActionButton>
                                  <ActionButton onClick={() => toggleDuplicatePanel(cluster, "reviewed")}>
                                    Mark reviewed
                                  </ActionButton>
                                </div>
                              </div>

                              <div className="grid gap-3 px-3 py-3 xl:grid-cols-2">
                                <div className="space-y-3">
                                  <InfoBlock label="Titles / Types">
                                    <div className="space-y-2">
                                      <div>{cluster.distinct_titles.join(" • ") || "—"}</div>
                                      <div className="text-[10px] text-[var(--admin-text-muted)]">
                                        {cluster.distinct_source_types.join(" • ") || "—"}
                                      </div>
                                    </div>
                                  </InfoBlock>
                                  <InfoBlock label="Publisher / Date">
                                    <div className="space-y-2">
                                      <div>{cluster.distinct_publishers.join(" • ") || "—"}</div>
                                      <div className="text-[10px] text-[var(--admin-text-muted)]">
                                        {cluster.distinct_published_dates.join(" • ") || "—"}
                                      </div>
                                    </div>
                                  </InfoBlock>
                                  <InfoBlock label="Open Source URL">
                                    <Link
                                      href={cluster.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="break-all text-[var(--admin-link)] underline"
                                    >
                                      {cluster.source_url}
                                    </Link>
                                  </InfoBlock>
                                </div>

                                <div className="space-y-3">
                                  <InfoBlock label="Policy Ownership">
                                    {cluster.distinct_policy_ids.length
                                      ? cluster.distinct_policy_ids.join(", ")
                                      : "none"}
                                  </InfoBlock>
                                  <InfoBlock label="Rejected Reasons">
                                    {(cluster.auto_merge_rejected_reasons || []).length ? (
                                      <div className="flex flex-wrap gap-1">
                                        {cluster.auto_merge_rejected_reasons.map((reason) => (
                                          <CompactBadge key={reason} tone="warning">
                                            {reason}
                                          </CompactBadge>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-[var(--admin-text-muted)]">No rejected reasons recorded</span>
                                    )}
                                  </InfoBlock>
                                  <InfoBlock label="Saved Decision">
                                    {cluster.saved_decision ? (
                                      <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <CompactBadge tone={cluster.ui_status.tone}>
                                            {cluster.ui_status.label}
                                          </CompactBadge>
                                          <span className="font-medium text-[var(--admin-text)]">
                                            {decisionSummary(cluster.saved_decision)}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-[var(--admin-text-muted)]">
                                          {formatAdminDateTime(cluster.saved_decision.confirmedAt)}
                                        </div>
                                        {cluster.saved_decision.note ? (
                                          <div className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-2 text-[11px] text-[var(--admin-text-soft)]">
                                            {cluster.saved_decision.note}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <span className="text-[var(--admin-text-muted)]">No saved decision</span>
                                    )}
                                  </InfoBlock>
                                </div>
                              </div>

                              {panel ? (
                                <div className="border-t border-[var(--admin-line)] bg-[var(--admin-surface-muted)] px-3 py-3">
                                  {panel === "compare" || panel === "merge" ? (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        {cluster.rows.map((row) => {
                                          const selectedForMerge = draft.selectedSourceIds.includes(row.id);

                                          return (
                                            <div
                                              key={row.id}
                                              className="rounded border border-[var(--admin-line)] bg-[var(--admin-surface)] p-3"
                                            >
                                              <div className="flex flex-wrap items-start gap-3">
                                                {panel === "merge" ? (
                                                  <div className="flex flex-col gap-2 pt-0.5">
                                                    <label className="flex items-center gap-2 text-[11px] text-[var(--admin-text-soft)]">
                                                      <input
                                                        type="checkbox"
                                                        checked={selectedForMerge}
                                                        onChange={() =>
                                                          toggleClusterSelection(cluster.cluster_key, row.id)
                                                        }
                                                      />
                                                      <span>Select</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 text-[11px] text-[var(--admin-text-soft)]">
                                                      <input
                                                        type="radio"
                                                        name={`canonical-${cluster.cluster_key}`}
                                                        checked={draft.canonicalSourceId === row.id}
                                                        disabled={!selectedForMerge}
                                                        onChange={() =>
                                                          updateDuplicateDraft(
                                                            cluster.cluster_key,
                                                            "canonicalSourceId",
                                                            row.id
                                                          )
                                                        }
                                                      />
                                                      <span>Keep</span>
                                                    </label>
                                                  </div>
                                                ) : null}

                                                <div className="min-w-0 flex-1">
                                                  <div className="font-medium text-[var(--admin-text)]">
                                                    #{row.id} {row.source_title}
                                                  </div>
                                                  <div className="mt-1 break-all font-mono text-[10px] text-[var(--admin-text-muted)]">
                                                    {row.source_url}
                                                  </div>
                                                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[var(--admin-text-soft)]">
                                                    <CompactBadge>{row.source_type || "unknown"}</CompactBadge>
                                                    <span>
                                                      {row.publisher || "publisher unavailable"}
                                                      {row.published_date ? ` • ${row.published_date}` : ""}
                                                    </span>
                                                    <span>
                                                      policy: {row.policy_id == null ? "none" : row.policy_id}
                                                    </span>
                                                    <span>
                                                      {row.promise_refs} promise / {row.action_refs} action /{" "}
                                                      {row.outcome_refs} outcome
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
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
                                                prepareDuplicateAction(cluster, "merge_duplicate_sources")
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
                                          audited, and may mutate canonical source rows if I confirm
                                          a merge.
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
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
