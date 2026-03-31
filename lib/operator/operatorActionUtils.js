const REQUIRED_ACTION_FIELDS = [
  "id",
  "label",
  "description",
  "workflow",
  "execution_method",
];
const FORBIDDEN_ACTION_TERMS = ["approve", "approval", "finalize", "import"];

export function normalizeOperatorActionInput(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function getOperatorActionCandidates(action) {
  return [
    action?.label,
    action?.canonical_input,
    ...(Array.isArray(action?.synonyms) ? action.synonyms : []),
  ]
    .map(normalizeOperatorActionInput)
    .filter(Boolean);
}

export function resolveExactOperatorActionFromInput(actions, input) {
  const normalizedInput = normalizeOperatorActionInput(input);
  if (!normalizedInput) {
    return null;
  }

  return (
    (actions || []).find((action) =>
      getOperatorActionCandidates(action).includes(normalizedInput)
    ) || null
  );
}

export function getSuggestedOperatorActions(actions, input, limit = 8) {
  const normalizedInput = normalizeOperatorActionInput(input);
  if (!normalizedInput) {
    return [];
  }

  return (actions || [])
    .filter((action) =>
      getOperatorActionCandidates(action).some((candidate) =>
        candidate.includes(normalizedInput)
      )
    )
    .slice(0, limit);
}

export function groupOperatorActionsByWorkflow(actions) {
  const groups = {
    "current-admin": [],
    legislative: [],
    policies: [],
    system: [],
  };

  for (const action of actions || []) {
    if (!groups[action.workflow]) {
      groups[action.workflow] = [];
    }
    groups[action.workflow].push(action);
  }

  return groups;
}

export function filterOperatorActionHistory(history, status) {
  if (status === "all") {
    return history || [];
  }
  return (history || []).filter((entry) => entry.status === status);
}

export function formatWorkflowLabel(workflow) {
  if (workflow === "current-admin") {
    return "Current-Admin";
  }
  if (workflow === "legislative") {
    return "Legislative";
  }
  if (workflow === "system") {
    return "System";
  }
  if (workflow === "policies") {
    return "Policies";
  }
  return workflow || "Unknown";
}

export function validateOperatorActionRegistry(actions) {
  const idSet = new Set();
  const normalizedCandidateSet = new Set();

  for (const action of actions || []) {
    const actionCandidateSet = new Set();

    for (const field of REQUIRED_ACTION_FIELDS) {
      if (!String(action?.[field] || "").trim()) {
        throw new Error(`Operator action is missing required field: ${field}`);
      }
    }

    if (idSet.has(action.id)) {
      throw new Error(`Duplicate operator action id detected: ${action.id}`);
    }
    idSet.add(action.id);

    const safetyString = `${action.id} ${action.label}`.toLowerCase();
    if (FORBIDDEN_ACTION_TERMS.some((term) => safetyString.includes(term))) {
      throw new Error(
        `Unsafe operator action detected in registry: ${action.id}`
      );
    }

    for (const candidate of getOperatorActionCandidates(action)) {
      if (actionCandidateSet.has(candidate)) {
        continue;
      }
      actionCandidateSet.add(candidate);

      if (normalizedCandidateSet.has(candidate)) {
        throw new Error(
          `Duplicate operator action label or synonym detected: ${candidate}`
        );
      }
      normalizedCandidateSet.add(candidate);
    }
  }

  return true;
}
