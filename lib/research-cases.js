import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";

const CASES_DIR = path.join(process.cwd(), "research/cases");

function stripFrontmatter(raw) {
  const text = String(raw || "").trim();

  if (!text.startsWith("---")) {
    return text;
  }

  const endIndex = text.indexOf("\n---", 3);

  if (endIndex === -1) {
    return text;
  }

  return text.slice(endIndex + 4).trim();
}

function slugFromFilename(filename) {
  return filename.replace(/\.md$/i, "");
}

function parseMetadataLine(line) {
  const match = String(line || "").match(/^([^:]+):\s*(.*)$/);

  if (!match) {
    return null;
  }

  return {
    key: match[1].trim(),
    value: match[2].trim(),
  };
}

function parseCaseMarkdown(slug, rawMarkdown) {
  const markdown = stripFrontmatter(rawMarkdown);
  const lines = markdown.split(/\r?\n/);
  const titleLine = lines.find((line) => line.startsWith("# "));
  const title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : slug;
  const titleIndex = titleLine ? lines.indexOf(titleLine) : -1;
  const contentLines = titleIndex >= 0 ? lines.slice(titleIndex + 1) : lines;
  const metadata = [];
  const sections = [];
  let currentSection = null;

  for (const line of contentLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (/^[A-Za-z][A-Za-z ]+:$/.test(trimmed)) {
      currentSection = {
        title: trimmed.replace(/:$/, ""),
        paragraphs: [],
      };
      sections.push(currentSection);
      continue;
    }

    const metadataLine = parseMetadataLine(trimmed);

    if (metadataLine && metadataLine.key.toLowerCase() === "tags") {
      metadata.push(metadataLine);
      continue;
    }

    if (!currentSection) {

      if (metadataLine) {
        metadata.push(metadataLine);
      }

      continue;
    }

    currentSection.paragraphs.push(trimmed);
  }

  const metadataMap = new Map(
    metadata.map((item) => [item.key.toLowerCase(), item.value])
  );
  const summary = sections.find((section) => section.title === "Summary")
    ?.paragraphs?.[0] || "";

  return {
    slug,
    title,
    summary,
    metadata,
    metadataMap,
    sections,
    rawMarkdown: markdown,
  };
}

export function getResearchCaseSlugs() {
  if (!existsSync(CASES_DIR)) {
    return [];
  }

  return readdirSync(CASES_DIR)
    .filter((filename) => filename.endsWith(".md"))
    .map(slugFromFilename)
    .sort((left, right) => left.localeCompare(right));
}

export function getResearchCaseBySlug(slug) {
  const normalizedSlug = String(slug || "").trim();

  if (!normalizedSlug || normalizedSlug.includes("/") || normalizedSlug.includes("..")) {
    return null;
  }

  const filePath = path.join(CASES_DIR, `${normalizedSlug}.md`);

  if (!existsSync(filePath)) {
    return null;
  }

  return parseCaseMarkdown(normalizedSlug, readFileSync(filePath, "utf8"));
}

export function getResearchCases() {
  return getResearchCaseSlugs()
    .map((slug) => getResearchCaseBySlug(slug))
    .filter(Boolean);
}
