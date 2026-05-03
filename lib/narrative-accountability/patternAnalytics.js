import { getPublishedNarrativeStatementsByTag } from "./data.js";
import { getNarrativeTagById } from "./narrative-tags.js";

const validStatementDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function getStatementYear(statement) {
  const value = String(statement?.statement_date || "").trim();
  if (!validStatementDatePattern.test(value)) {
    return null;
  }

  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function getDatedVisiblePublishedStatements(tagId) {
  if (!getNarrativeTagById(tagId)) {
    return [];
  }

  return getPublishedNarrativeStatementsByTag(tagId)
    .map((item) => {
      const year = getStatementYear(item?.statement);
      if (!year) {
        return null;
      }

      return {
        ...item,
        year,
      };
    })
    .filter(Boolean);
}

function getSourceKey(source) {
  return String(
    source?.url ||
      [
        source?.publisher_or_source || source?.label || "",
        source?.title || "",
        source?.note || "",
      ]
        .filter(Boolean)
        .join("::")
  ).trim();
}

function getSourceDomain(source) {
  const rawUrl = String(source?.url || "").trim();
  if (!rawUrl) {
    return null;
  }

  try {
    const hostname = new URL(rawUrl).hostname.trim().toLowerCase();
    return hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function getTimelineDensityLevel(count, maxCount) {
  if (!count || !maxCount) {
    return 0;
  }

  const ratio = count / maxCount;

  if (ratio >= 0.67) {
    return 3;
  }

  if (ratio >= 0.34) {
    return 2;
  }

  return 1;
}

export function getNarrativeConcentration(tagId) {
  if (!getNarrativeTagById(tagId)) {
    return [];
  }

  const statements = getPublishedNarrativeStatementsByTag(tagId);
  const totalCount = statements.length;

  if (!totalCount) {
    return [];
  }

  const profiles = new Map();

  statements.forEach((item) => {
    if (!profiles.has(item.profile_slug)) {
      profiles.set(item.profile_slug, {
        profile_slug: item.profile_slug,
        profile_name: item.profile_name,
        portrait_url: item.portrait_url || null,
        platform_or_role: item.platform_or_role || null,
        statement_count: 0,
      });
    }

    profiles.get(item.profile_slug).statement_count += 1;
  });

  return Array.from(profiles.values())
    .map((profile) => ({
      ...profile,
      share_percent:
        Math.round((profile.statement_count / totalCount) * 1000) / 10,
    }))
    .sort((left, right) => {
      if (right.statement_count !== left.statement_count) {
        return right.statement_count - left.statement_count;
      }

      return String(left.profile_name || "").localeCompare(
        String(right.profile_name || "")
      );
    });
}

export function getNarrativeCoverage(tagId) {
  if (!getNarrativeTagById(tagId)) {
    return {
      statement_count: 0,
      profile_count: 0,
      avg_sources_per_statement: 0,
      source_diversity_score: 0,
      coverage_level: "low",
    };
  }

  const statements = getPublishedNarrativeStatementsByTag(tagId);
  const profileSlugs = new Set();
  const domains = new Set();
  let sourceTotal = 0;

  statements.forEach((item) => {
    if (item.profile_slug) {
      profileSlugs.add(item.profile_slug);
    }

    const statementSources = [
      ...(Array.isArray(item.statement_sources) ? item.statement_sources : []),
      ...(Array.isArray(item.receipts) ? item.receipts : []),
    ];
    const sourceKeys = new Set();

    statementSources.forEach((source) => {
      const key = getSourceKey(source);
      if (key) {
        sourceKeys.add(key);
      }

      const domain = getSourceDomain(source);
      if (domain) {
        domains.add(domain);
      }
    });

    sourceTotal += sourceKeys.size;
  });

  const statementCount = statements.length;
  const profileCount = profileSlugs.size;
  const avgSourcesPerStatement =
    statementCount > 0 ? sourceTotal / statementCount : 0;
  const sourceDiversityScore = domains.size;

  let coverageLevel = "low";
  if (
    statementCount >= 4 &&
    profileCount >= 3 &&
    avgSourcesPerStatement >= 3 &&
    sourceDiversityScore >= 4
  ) {
    coverageLevel = "strong";
  } else if (
    statementCount >= 2 &&
    profileCount >= 2 &&
    avgSourcesPerStatement >= 2 &&
    sourceDiversityScore >= 2
  ) {
    coverageLevel = "moderate";
  }

  return {
    statement_count: statementCount,
    profile_count: profileCount,
    avg_sources_per_statement:
      Math.round(avgSourcesPerStatement * 10) / 10,
    source_diversity_score: sourceDiversityScore,
    coverage_level: coverageLevel,
  };
}

export function getNarrativeTimeline(tagId) {
  const counts = new Map();

  getDatedVisiblePublishedStatements(tagId).forEach((item) => {
    counts.set(item.year, (counts.get(item.year) || 0) + 1);
  });

  const maxCount = Array.from(counts.values()).reduce(
    (max, count) => Math.max(max, count),
    0
  );

  return Array.from(counts.entries())
    .map(([year, count]) => ({
      year,
      count,
      max_count: maxCount,
      density_level: getTimelineDensityLevel(count, maxCount),
    }))
    .sort((left, right) => left.year - right.year);
}

export function getNarrativeTimelineByProfile(tagId) {
  const profiles = new Map();

  getDatedVisiblePublishedStatements(tagId).forEach((item) => {
    if (!profiles.has(item.profile_slug)) {
      profiles.set(item.profile_slug, {
        profile_slug: item.profile_slug,
        profile_name: item.profile_name,
        yearly_counts: new Map(),
      });
    }

    const current = profiles.get(item.profile_slug);
    current.yearly_counts.set(
      item.year,
      (current.yearly_counts.get(item.year) || 0) + 1
    );
  });

  return Array.from(profiles.values())
    .map((entry) => ({
      profile_slug: entry.profile_slug,
      profile_name: entry.profile_name,
      yearly_counts: Array.from(entry.yearly_counts.entries())
        .map(([year, count]) => ({
          year,
          count,
        }))
        .sort((left, right) => left.year - right.year),
    }))
    .sort((left, right) => {
      const leftTotal = left.yearly_counts.reduce((sum, item) => sum + item.count, 0);
      const rightTotal = right.yearly_counts.reduce((sum, item) => sum + item.count, 0);

      if (rightTotal !== leftTotal) {
        return rightTotal - leftTotal;
      }

      return String(left.profile_name || "").localeCompare(
        String(right.profile_name || "")
      );
    });
}
