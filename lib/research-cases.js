import { RESEARCH_CASES } from "./cases.js";

const MARKDOWN_EXTENSION_RE = /\.md$/i;

export function normalizeResearchCaseSlug(value) {
  return String(value || "").trim().replace(MARKDOWN_EXTENSION_RE, "");
}

function formatListValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value || "").trim();
}

function buildMetadata(researchCase) {
  return [
    { key: "Domain", value: formatListValue(researchCase.domains) },
    { key: "Type", value: researchCase.type },
    { key: "Status", value: researchCase.status },
  ].filter((item) => item.value);
}

function normalizeResearchCaseRecord(researchCase) {
  const slug = normalizeResearchCaseSlug(researchCase?.id);
  const metadata = buildMetadata(researchCase);
  const metadataMap = new Map(
    metadata.map((item) => [item.key.toLowerCase(), item.value])
  );

  return {
    slug,
    id: slug,
    title: researchCase.title,
    summary: researchCase.summary || "",
    metadata,
    metadataMap,
    sections: researchCase.summary
      ? [{ title: "Summary", paragraphs: [researchCase.summary] }]
      : [],
  };
}

export function getResearchCaseSlugs() {
  return RESEARCH_CASES.map((item) => normalizeResearchCaseSlug(item.id))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function getResearchCaseBySlug(slug) {
  const normalizedSlug = normalizeResearchCaseSlug(slug);

  if (
    !normalizedSlug ||
    normalizedSlug.includes("/") ||
    normalizedSlug.includes("..")
  ) {
    return null;
  }

  const researchCase = RESEARCH_CASES.find(
    (item) => normalizeResearchCaseSlug(item.id) === normalizedSlug
  );

  return researchCase ? normalizeResearchCaseRecord(researchCase) : null;
}

export function getResearchCases() {
  return getResearchCaseSlugs()
    .map((slug) => getResearchCaseBySlug(slug))
    .filter(Boolean);
}
