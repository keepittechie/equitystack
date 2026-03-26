export function formatPartyLabel(policy) {
  const party = policy?.primary_party;

  if (policy?.policy_type === "Court Case") {
    return "Judicial Branch";
  }

  if (!party || party === "Other") {
    return "No Primary Party";
  }

  return party;
}
